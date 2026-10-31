"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parentInvites } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { linkParentToStudent } from "@/lib/queries/guardianships";
import { findInviteByCode } from "@/lib/queries/parent-invites";
import { findUserById } from "@/lib/queries/users";
import { normalizeLinkCode } from "@/lib/link-codes";
import { redeemLinkCodeSchema } from "@lms/shared";
import { toState, type ActionState } from "@/lib/actions";

/** Codes are 8 chars from a 23-letter alphabet; this cap makes guessing useless. */
const MAX_ATTEMPTS = 10;

export type RedeemedChild = { id: string; name: string };

/**
 * The parent redeems a code the student gave them, from inside their own panel.
 *
 * This replaces the Clerk invitation: the parent can already have an account
 * (any role area they were approved for), they just need to prove they were
 * given the code. The student is resolved from the code, never from the client,
 * and the link is claimed atomically so two browser tabs cannot both win.
 *
 * The atomic claim is the UPDATE ... WHERE state = 'sent' below: it was
 * `findOneAndUpdate` in Mongo, and the `state = 'sent'` predicate is still the
 * lock. A second tab's claim matches zero rows and fails cleanly.
 */
export async function redeemLinkCode(
  raw: unknown,
): Promise<ActionState<RedeemedChild>> {
  try {
    const session = await requireRole(["parent"]);
    const { code } = redeemLinkCodeSchema.parse(raw);
    const normalized = normalizeLinkCode(code);

    if (normalized.length !== 8) {
      throw new Error(
        "A link code is 8 characters. Check the code your child gave you.",
      );
    }

    const invite = await findInviteByCode(normalized);
    if (!invite) throw new Error("That code does not match any student.");
    if (invite.state === "accepted")
      throw new Error("This code has already been used.");
    if (invite.state === "revoked")
      throw new Error("This code was cancelled by the student.");
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new Error("This code has expired. Ask your child for a new one.");
    }
    if (invite.attempts >= MAX_ATTEMPTS) {
      throw new Error(
        "Too many attempts on this code. Ask your child for a new one.",
      );
    }
    if (invite.studentId === session.actorId) {
      throw new Error("You cannot link your own account as your parent.");
    }

    const [student, parent] = await Promise.all([
      findUserById(invite.studentId),
      findUserById(session.actorId),
    ]);
    if (!student || student.role !== "student" || student.status !== "active") {
      throw new Error("That student account is no longer active.");
    }

    await db.transaction(async (tx) => {
      // Claim the code only if it is still open: the filter is the lock.
      const claimed = await tx
        .update(parentInvites)
        .set({
          state: "accepted",
          acceptedBy: session.actorId,
          acceptedAt: new Date(),
          parentEmail: parent?.email ?? invite.parentEmail,
        })
        .where(
          and(eq(parentInvites.id, invite.id), eq(parentInvites.state, "sent")),
        )
        .returning({ id: parentInvites.id });

      if (claimed.length === 0)
        throw new Error("This code has already been used.");

      await linkParentToStudent(
        session.actorId,
        invite.studentId,
        { markOnboarded: true },
        tx,
      );

      await writeAudit(
        {
          actorId: session.actorId,
          action: "redeemParentLink",
          targetType: "ParentInvite",
          targetId: invite.id,
          before: { state: "sent" },
          after: {
            state: "accepted",
            studentId: invite.studentId,
            parentId: session.actorId,
          },
        },
        { tx },
      );
    });

    revalidatePath("/parent");
    revalidatePath("/parent/children");
    revalidatePath("/student/guardians");
    revalidatePath("/admin/parent-invites");

    return { ok: true, data: { id: student.id, name: student.name } };
  } catch (error) {
    // Count a failed guess, but never fail the response over it.
    const shaped = toState(error);
    try {
      const rawCode = (raw as { code?: unknown })?.code;
      if (typeof rawCode === "string") {
        await db
          .update(parentInvites)
          .set({
            attempts: sql`${parentInvites.attempts} + 1`,
            lastAttemptAt: new Date(),
          })
          .where(
            and(
              eq(parentInvites.code, normalizeLinkCode(rawCode)),
              eq(parentInvites.state, "sent"),
            ),
          );
      }
    } catch (countError) {
      console.error(
        "[parent-link] Could not record a failed attempt:",
        countError,
      );
    }
    return shaped;
  }
}
