"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { parentInvites } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { uniqueLinkCode, LINK_CODE_TTL_DAYS } from "@/lib/link-codes";
import { listParentIdsForStudent } from "@/lib/queries/guardianships";
import { createInvite, findInviteById } from "@/lib/queries/parent-invites";
import {
  findUserByClerkId,
  findUserByEmail,
  findUserById,
} from "@/lib/queries/users";
import { recordIdSchema } from "@/lib/validators/common";
import { studentParentSchema } from "@/lib/validators/parent";
import { toState, type ActionState } from "@/lib/actions";

/**
 * The student issues a link code for a guardian.
 *
 * No email is sent and no Clerk invitation is created: the parent signs up as a
 * normal account, then redeems the code from their own panel
 * (`redeemLinkCode` in `actions/parent-link.ts`). The whole relation stays in
 * our own database, so it does not depend on an inbox, on Clerk's invitation
 * delivery, or on a webhook arriving.
 */
export async function createParentLink(
  raw: unknown,
): Promise<ActionState<{ code: string; expiresAt: string }>> {
  try {
    const actor = await requireRole(["student"]);
    const input = studentParentSchema.parse(raw);

    const student = await findUserByClerkId(actor.clerkId);
    if (!student || student.role !== "student" || student.status !== "active") {
      throw new Error("Student account not found");
    }

    // Was a count over `parent.childIds`; now the number of link rows.
    const alreadyLinked = await listParentIdsForStudent(student.id);
    if (alreadyLinked.length >= 5) {
      throw new Error(
        "You already have the maximum number of guardians linked",
      );
    }

    if (input.parentEmail) {
      const existing = await findUserByEmail(input.parentEmail);
      if (existing) {
        throw new Error(
          "That email already has an account. They should sign in and enter your link code from their own panel.",
        );
      }
    }

    const code = await uniqueLinkCode();
    const expiresAt = new Date(
      Date.now() + LINK_CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invite = await db.transaction(async (tx) => {
      const created = await createInvite(
        {
          studentId: student.id,
          parentName: input.parentName,
          parentEmail: input.parentEmail ?? "",
          code,
          expiresAt,
        },
        tx,
      );

      await writeAudit(
        {
          actorId: student.id,
          action: "createParentLink",
          targetType: "ParentInvite",
          targetId: created.id,
          after: {
            studentId: student.id,
            parentName: input.parentName,
            code,
            expiresAt: expiresAt.toISOString(),
          },
        },
        { tx },
      );

      return created;
    });

    revalidatePath("/student/guardians");
    revalidatePath("/onboarding/parent");
    return {
      ok: true,
      data: { code: invite.code, expiresAt: expiresAt.toISOString() },
    };
  } catch (error) {
    return toState(error);
  }
}

/** Revoke a code the student no longer wants to share. */
export async function revokeParentLink(inviteId: string): Promise<ActionState> {
  try {
    const actor = await requireRole(["student"]);
    const id = recordIdSchema.parse(inviteId);

    await db.transaction(async (tx) => {
      const invite = await findInviteById(id, tx);
      if (
        !invite ||
        invite.studentId !== actor.actorId ||
        invite.state !== "sent"
      ) {
        throw new Error("That code is no longer active");
      }

      await tx
        .update(parentInvites)
        .set({ state: "revoked" })
        .where(eq(parentInvites.id, invite.id));

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "revokeParentLink",
          targetType: "ParentInvite",
          targetId: invite.id,
          before: { state: "sent" },
          after: { state: "revoked" },
        },
        { tx },
      );
    });

    revalidatePath("/student/guardians");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export type GuardianRow = {
  id: string;
  name: string | null;
  email: string;
  state: "active" | "sent" | "expired" | "revoked";
  /** Only present for an unused, unexpired code. */
  code?: string;
  expiresAt?: string;
};

/** Guardians of the signed-in student: linked accounts first, then open codes. */
export async function listMyGuardians(): Promise<GuardianRow[]> {
  const actor = await requireRole(["student"]);

  const [parentIds, invites] = await Promise.all([
    listParentIdsForStudent(actor.actorId),
    db
      .select()
      .from(parentInvites)
      .where(
        and(
          eq(parentInvites.studentId, actor.actorId),
          ne(parentInvites.state, "accepted"),
        ),
      )
      .orderBy(desc(parentInvites.createdAt)),
  ]);

  const parents = await Promise.all(parentIds.map((id) => findUserById(id)));

  const rows: GuardianRow[] = parents
    .filter((parent): parent is NonNullable<typeof parent> => Boolean(parent))
    .map((parent) => ({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      state: "active",
    }));

  for (const invite of invites) {
    const expired = invite.expiresAt ? invite.expiresAt <= new Date() : false;
    const state =
      invite.state === "revoked" ? "revoked" : expired ? "expired" : "sent";
    rows.push({
      id: invite.id,
      name: invite.parentName,
      email: invite.parentEmail,
      state,
      code: state === "sent" ? invite.code : undefined,
      expiresAt: invite.expiresAt?.toISOString(),
    });
  }

  return rows;
}
