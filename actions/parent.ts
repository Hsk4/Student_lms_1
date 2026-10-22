"use server";

import { revalidatePath } from "next/cache";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { ParentInvite } from "@/models/parent-invite";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { uniqueLinkCode, LINK_CODE_TTL_DAYS } from "@/lib/link-codes";
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
    await connectDB();

    const student = await User.findOne({
      clerkId: actor.clerkId,
      role: "student",
      status: "active",
    });
    if (!student) throw new Error("Student account not found");

    const alreadyLinked = await User.countDocuments({
      "parent.childIds": student._id,
    });
    if (alreadyLinked >= 5) {
      throw new Error(
        "You already have the maximum number of guardians linked",
      );
    }

    if (input.parentEmail) {
      const existing = await User.findOne({ email: input.parentEmail })
        .select("_id")
        .lean();
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

    const invite = await withTransaction(async (dbSession) => {
      const [created] = await ParentInvite.create(
        [
          {
            studentId: student._id,
            parentName: input.parentName,
            parentEmail: input.parentEmail ?? "",
            code,
            state: "sent",
            expiresAt,
          },
        ],
        { session: dbSession },
      );

      await writeAudit(
        {
          actorId: student._id,
          action: "createParentLink",
          targetType: "ParentInvite",
          targetId: created._id,
          after: {
            studentId: String(student._id),
            parentName: input.parentName,
            code,
            expiresAt: expiresAt.toISOString(),
          },
        },
        dbSession,
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
    await connectDB();

    const invite = await ParentInvite.findOne({
      _id: inviteId,
      studentId: actor.actorId,
      state: "sent",
    });
    if (!invite) throw new Error("That code is no longer active");

    invite.state = "revoked";
    await invite.save();

    await writeAudit({
      actorId: actor.actorId,
      action: "revokeParentLink",
      targetType: "ParentInvite",
      targetId: invite._id,
      before: { state: "sent" },
      after: { state: "revoked" },
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
  await connectDB();

  const [parents, invites] = await Promise.all([
    User.find({ role: "parent", "parent.childIds": actor.actorId })
      .select("name email")
      .lean(),
    ParentInvite.find({ studentId: actor.actorId, state: { $ne: "accepted" } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const rows: GuardianRow[] = parents.map((parent) => ({
    id: String(parent._id),
    name: parent.name,
    email: parent.email,
    state: "active",
  }));

  for (const invite of invites) {
    const expired = invite.expiresAt ? invite.expiresAt <= new Date() : false;
    const state =
      invite.state === "revoked" ? "revoked" : expired ? "expired" : "sent";
    rows.push({
      id: String(invite._id),
      name: invite.parentName,
      email: invite.parentEmail,
      state,
      code: state === "sent" ? invite.code : undefined,
      expiresAt: invite.expiresAt?.toISOString(),
    });
  }

  return rows;
}
