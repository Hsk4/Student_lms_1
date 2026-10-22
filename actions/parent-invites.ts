"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ParentInvite } from "@/models/parent-invite";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { uniqueLinkCode, LINK_CODE_TTL_DAYS } from "@/lib/link-codes";
import { toState, type ActionState } from "@/lib/actions";

/**
 * Cancel a link code. No external service is involved: the code simply stops
 * matching in `redeemLinkCode`.
 */
export async function revokeParentInvite(
  inviteId: string,
): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    await connectDB();

    const invite = await ParentInvite.findById(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.state === "revoked") throw new Error("Invite already revoked");
    if (invite.state === "accepted")
      throw new Error("Cannot revoke an accepted invite");

    invite.state = "revoked";
    await invite.save();

    await writeAudit({
      actorId: actor.actorId,
      action: "revokeParentInvite",
      targetType: "ParentInvite",
      targetId: invite._id,
      before: { state: "sent" },
      after: { state: "revoked" },
    });

    revalidatePath("/admin/parent-invites");
    revalidatePath("/student/guardians");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Issue a fresh code for an existing invite, for when the student lost it or it
 * expired. The old code stops working immediately.
 */
export async function reissueParentInvite(
  inviteId: string,
): Promise<ActionState<{ code: string }>> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    await connectDB();

    const invite = await ParentInvite.findById(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.state === "accepted")
      throw new Error("This guardian is already linked");

    const previousCode = invite.code;
    invite.code = await uniqueLinkCode();
    invite.state = "sent";
    invite.expiresAt = new Date(
      Date.now() + LINK_CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    invite.attempts = 0;
    await invite.save();

    await writeAudit({
      actorId: actor.actorId,
      action: "reissueParentInvite",
      targetType: "ParentInvite",
      targetId: invite._id,
      before: { code: previousCode, state: "sent" },
      after: {
        code: invite.code,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
      },
    });

    revalidatePath("/admin/parent-invites");
    revalidatePath("/student/guardians");
    return { ok: true, data: { code: invite.code } };
  } catch (error) {
    return toState(error);
  }
}
