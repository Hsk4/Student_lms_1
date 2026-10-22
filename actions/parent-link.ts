"use server";

import { revalidatePath } from "next/cache";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { ParentInvite } from "@/models/parent-invite";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { linkParentToStudent } from "@/lib/guardians";
import { normalizeLinkCode } from "@/lib/link-codes";
import { redeemLinkCodeSchema } from "@/lib/validators/parent";
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

    await connectDB();

    const invite = await ParentInvite.findOne({ code: normalized });
    if (!invite) throw new Error("That code does not match any student.");
    if (invite.state === "accepted")
      throw new Error("This code has already been used.");
    if (invite.state === "revoked")
      throw new Error("This code was cancelled by the student.");
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new Error("This code has expired. Ask your child for a new one.");
    }
    if ((invite.attempts ?? 0) >= MAX_ATTEMPTS) {
      throw new Error(
        "Too many attempts on this code. Ask your child for a new one.",
      );
    }
    if (String(invite.studentId) === session.actorId) {
      throw new Error("You cannot link your own account as your parent.");
    }

    const student = await User.findOne({
      _id: invite.studentId,
      role: "student",
      status: "active",
    })
      .select("name")
      .lean();
    if (!student) throw new Error("That student account is no longer active.");

    const parent = await User.findById(session.actorId).select("email").lean();

    await withTransaction(async (dbSession) => {
      // Claim the code only if it is still open: the filter is the lock.
      const claimed = await ParentInvite.findOneAndUpdate(
        { _id: invite._id, state: "sent" },
        {
          $set: {
            state: "accepted",
            acceptedBy: session.actorId,
            acceptedAt: new Date(),
            parentEmail: parent?.email ?? invite.parentEmail,
          },
        },
        { returnDocument: "after", session: dbSession },
      );

      if (!claimed) throw new Error("This code has already been used.");

      await linkParentToStudent(
        session.actorId,
        invite.studentId,
        { markOnboarded: true },
        dbSession,
      );

      await writeAudit(
        {
          actorId: session.actorId,
          action: "redeemParentLink",
          targetType: "ParentInvite",
          targetId: invite._id,
          before: { state: "sent" },
          after: {
            state: "accepted",
            studentId: String(invite.studentId),
            parentId: session.actorId,
          },
        },
        dbSession,
      );
    });

    revalidatePath("/parent");
    revalidatePath("/parent/children");
    revalidatePath("/student/guardians");
    revalidatePath("/admin/parent-invites");

    return { ok: true, data: { id: String(student._id), name: student.name } };
  } catch (error) {
    // Count a failed guess, but never fail the response over it.
    const shaped = toState(error);
    try {
      const rawCode = (raw as { code?: unknown })?.code;
      if (typeof rawCode === "string") {
        await ParentInvite.updateOne(
          { code: normalizeLinkCode(rawCode), state: "sent" },
          { $inc: { attempts: 1 }, $set: { lastAttemptAt: new Date() } },
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
