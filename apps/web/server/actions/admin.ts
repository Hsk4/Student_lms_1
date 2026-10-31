"use server";

import { createClerkClient } from "@clerk/backend";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accessRequests, auditLogs } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { toState, type ActionState } from "@/lib/actions";
import { findRequestById } from "@/lib/queries/access-requests";
import { findUserById, updateUser } from "@/lib/queries/users";
import type { UserRole, UserStatus } from "@/lib/types";
import {
  assignRoleSchema,
  rejectUserSchema,
  requestDecisionSchema,
  userActionSchema,
} from "@lms/shared";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");
const clerk = createClerkClient({ secretKey });

async function updateMetadata(
  clerkId: string,
  publicMetadata: Record<string, unknown>,
) {
  await clerk.users.updateUserMetadata(clerkId, { publicMetadata });
}

function canManage(
  actorRole: "super_admin" | "admin",
  targetRole: string | null,
) {
  if (targetRole === "super_admin") return false;
  if (targetRole === "admin") return actorRole === "super_admin";
  return true;
}

/**
 * Removes exactly the audit row the action just wrote, as part of compensating
 * for a failed Clerk update. Matching on all three columns keeps unrelated
 * history for the same target intact.
 */
async function deleteAudit(
  key: { actorId: string; action: string; targetId: string },
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx
    .delete(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, key.actorId),
        eq(auditLogs.action, key.action),
        eq(auditLogs.targetId, key.targetId),
      ),
    );
}

/**
 * These actions are two-phase: Postgres commits, then Clerk is updated, and if
 * Clerk fails the Postgres half is rolled back by a compensating transaction.
 * That ordering is deliberate â€” a Clerk failure must not leave a role granted
 * in the database that the session claims do not reflect.
 */

export async function assignRole(
  userId: string,
  role: string,
): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = assignRoleSchema.parse({ userId, role });

    let clerkId = "";
    const before: Record<string, unknown> = {};
    await db.transaction(async (tx) => {
      const user = await findUserById(input.userId, tx);
      if (!user) throw new Error("User not found");
      if (!canManage(actor.role as "super_admin" | "admin", user.role)) {
        throw new Error("You cannot change this user");
      }

      clerkId = user.clerkId;
      Object.assign(before, {
        role: user.role,
        status: user.status,
        rejectedAt: user.rejectedAt,
        rejectionReason: user.rejectionReason,
      });

      await updateUser(
        user.id,
        {
          role: input.role as UserRole,
          status: "active",
          rejectedAt: null,
          rejectionReason: null,
        },
        tx,
      );
      await tx
        .update(accessRequests)
        .set({
          state: "approved",
          decidedBy: actor.actorId,
          decidedAt: new Date(),
        })
        .where(eq(accessRequests.userId, user.id));
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "assignRole",
          targetType: "User",
          targetId: user.id,
          before,
          after: { role: input.role, status: "active" },
        },
        { tx },
      );
    });

    try {
      await updateMetadata(clerkId, { role: input.role, status: "active" });
    } catch (error) {
      await db.transaction(async (tx) => {
        const user = await findUserById(userId, tx);
        await updateUser(
          userId,
          {
            role: (before.role as UserRole | null) ?? null,
            status: before.status as UserStatus,
            rejectedAt: (before.rejectedAt as Date | null) ?? null,
            rejectionReason: (before.rejectionReason as string | null) ?? null,
          },
          tx,
        );
        if (user) {
          await tx
            .update(accessRequests)
            .set({ state: "open", decidedBy: null, decidedAt: null })
            .where(eq(accessRequests.userId, user.id));
          await deleteAudit(
            { actorId: actor.actorId, action: "assignRole", targetId: user.id },
            tx,
          );
        }
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function rejectUser(
  userId: string,
  reason: string,
): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = rejectUserSchema.parse({ userId, reason });

    let clerkId = "";
    const before: Record<string, unknown> = {};
    await db.transaction(async (tx) => {
      const user = await findUserById(input.userId, tx);
      if (!user) throw new Error("User not found");
      if (!canManage(actor.role as "super_admin" | "admin", user.role)) {
        throw new Error("You cannot change this user");
      }

      clerkId = user.clerkId;
      Object.assign(before, {
        status: user.status,
        rejectedAt: user.rejectedAt,
        rejectionReason: user.rejectionReason,
      });

      await updateUser(
        user.id,
        {
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason: input.reason,
        },
        tx,
      );
      await tx
        .update(accessRequests)
        .set({
          state: "rejected",
          decidedBy: actor.actorId,
          decidedAt: new Date(),
          reason: input.reason,
        })
        .where(eq(accessRequests.userId, user.id));
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "rejectUser",
          targetType: "User",
          targetId: user.id,
          before,
          after: { status: "rejected", reason: input.reason },
        },
        { tx },
      );
    });

    try {
      await updateMetadata(clerkId, { role: null, status: "rejected" });
    } catch (error) {
      await db.transaction(async (tx) => {
        const user = await findUserById(userId, tx);
        await updateUser(
          userId,
          {
            status: before.status as UserStatus,
            rejectedAt: (before.rejectedAt as Date | null) ?? null,
            rejectionReason: (before.rejectionReason as string | null) ?? null,
          },
          tx,
        );
        if (user) {
          await tx
            .update(accessRequests)
            .set({
              state: "open",
              decidedBy: null,
              decidedAt: null,
              reason: null,
            })
            .where(eq(accessRequests.userId, user.id));
          await deleteAudit(
            { actorId: actor.actorId, action: "rejectUser", targetId: user.id },
            tx,
          );
        }
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

async function setStatus(
  userId: string,
  target: "suspended" | "active",
  action: "suspendUser" | "reinstateUser",
): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = userActionSchema.parse({ userId });

    let clerkId = "";
    let role: UserRole | null = null;
    let beforeStatus: UserStatus = "active";
    await db.transaction(async (tx) => {
      const user = await findUserById(input.userId, tx);
      if (!user) throw new Error("User not found");
      if (!canManage(actor.role as "super_admin" | "admin", user.role)) {
        throw new Error("You cannot change this user");
      }
      if (target === "active" && !user.role) {
        throw new Error("Assign a role before reinstating this user");
      }

      clerkId = user.clerkId;
      role = user.role;
      beforeStatus = user.status;
      await updateUser(user.id, { status: target }, tx);
      await writeAudit(
        {
          actorId: actor.actorId,
          action,
          targetType: "User",
          targetId: user.id,
          before: { status: beforeStatus },
          after: { status: target },
        },
        { tx },
      );
    });

    try {
      await updateMetadata(clerkId, { role, status: target });
    } catch (error) {
      await db.transaction(async (tx) => {
        await updateUser(userId, { status: beforeStatus }, tx);
        await deleteAudit({ actorId: actor.actorId, action, targetId: userId }, tx);
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function suspendUser(userId: string) {
  return setStatus(userId, "suspended", "suspendUser");
}

export async function reinstateUser(userId: string) {
  return setStatus(userId, "active", "reinstateUser");
}

export async function decideAccessRequest(
  requestId: string,
  decision: "approve" | "reject",
  role?: string,
  reason?: string,
): Promise<ActionState> {
  try {
    await requireRole(["super_admin", "admin"]);
    const input = requestDecisionSchema.parse({
      requestId,
      decision,
      role,
      reason,
    });

    const request = await findRequestById(input.requestId);
    if (!request || request.state !== "open")
      throw new Error("Open request not found");
    if (input.decision === "approve") {
      if (!input.role) throw new Error("Pick a role to approve this request");
      return assignRole(request.userId, input.role);
    }
    if (!input.reason) throw new Error("Give a reason for rejecting");
    return rejectUser(request.userId, input.reason);
  } catch (error) {
    return toState(error);
  }
}
