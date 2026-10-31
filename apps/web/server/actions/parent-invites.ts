"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parentInvites } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { uniqueLinkCode, LINK_CODE_TTL_DAYS } from "@/lib/link-codes";
import { findInviteById } from "@/lib/queries/parent-invites";
import { recordIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

/**
 * Cancel a link code. No external service is involved: the code simply stops
 * matching in `redeemLinkCode` because that action only claims `state = 'sent'`.
 */
export async function revokeParentInvite(
  inviteId: string,
): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const id = recordIdSchema.parse(inviteId);

    await db.transaction(async (tx) => {
      const invite = await findInviteById(id, tx);
      if (!invite) throw new Error("Invite not found");
      if (invite.state === "revoked") throw new Error("Invite already revoked");
      if (invite.state === "accepted") {
        throw new Error("Cannot revoke an accepted invite");
      }

      await tx
        .update(parentInvites)
        .set({ state: "revoked" })
        .where(eq(parentInvites.id, invite.id));

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "revokeParentInvite",
          targetType: "ParentInvite",
          targetId: invite.id,
          before: { state: invite.state },
          after: { state: "revoked" },
        },
        { tx },
      );
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
 * expired. The old code stops working immediately: the row keeps one `code`
 * column and it is overwritten here.
 */
export async function reissueParentInvite(
  inviteId: string,
): Promise<ActionState<{ code: string }>> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const id = recordIdSchema.parse(inviteId);
    const code = await uniqueLinkCode();
    const expiresAt = new Date(
      Date.now() + LINK_CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.transaction(async (tx) => {
      const invite = await findInviteById(id, tx);
      if (!invite) throw new Error("Invite not found");
      if (invite.state === "accepted") {
        throw new Error("This guardian is already linked");
      }

      await tx
        .update(parentInvites)
        .set({ code, state: "sent", expiresAt, attempts: 0 })
        .where(eq(parentInvites.id, invite.id));

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "reissueParentInvite",
          targetType: "ParentInvite",
          targetId: invite.id,
          before: { code: invite.code, state: invite.state },
          after: { code, expiresAt: expiresAt.toISOString() },
        },
        { tx },
      );
    });

    revalidatePath("/admin/parent-invites");
    revalidatePath("/student/guardians");
    return { ok: true, data: { code } };
  } catch (error) {
    return toState(error);
  }
}
