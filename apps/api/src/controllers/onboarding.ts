import type { Request } from "express";
import { eq } from "drizzle-orm";
import { accessRequestSchema, type GateUser } from "@lms/shared";
import { db } from "@/db";
import { accessRequests } from "@/db/schema";
import { conflict } from "@/lib/http-error";
import { actorOf } from "@/middleware/auth";
import {
  createAccessRequest,
  findOpenRequestForUser,
  setRequestSubjects,
} from "@/db/queries/access-requests";
import { findUserById, updateUser } from "@/db/queries/users";

/**
 * A pending or rejected account files an access request. Rejected users may
 * re-apply 30 days after `rejectedAt`; the request moves the account back to
 * pending. Ported from `actions/onboarding.ts`.
 */

function reapplyDateOf(rejectedAt: Date | null | undefined): Date | null {
  if (!rejectedAt) return null;
  const reapplyAt = new Date(rejectedAt);
  reapplyAt.setDate(reapplyAt.getDate() + 30);
  return reapplyAt;
}

function assertCanApply(
  status: string,
  rejectedAt: Date | null | undefined,
  role: string | null,
) {
  /*
   * A role IS the approval: an account that already holds one (the seeded super
   * admin, or anyone an admin assigned) has nothing to request. Without this a
   * super admin could file a request and demote themselves into the approval
   * queue. Checked before the status, because the seeded account may be
   * `pending`-with-a-role.
   */
  if (role) throw conflict("Your account already has a role");
  if (status === "active") throw conflict("Your account is already active");
  const reapplyAt = reapplyDateOf(rejectedAt);
  if (status === "rejected" && reapplyAt && reapplyAt > new Date()) {
    throw conflict(
      `You may re-apply from ${reapplyAt.toISOString().slice(0, 10)}`,
    );
  }
}

/** Reopen a rejected account in the local DB-backed identity model. */
async function reopenRejectedAccount(user: GateUser) {
  if (user.status !== "rejected") return;
  await updateUser(user.id, {
    status: "pending",
    rejectedAt: null,
    rejectionReason: null,
  });
}

/** `POST /api/v1/me/request` */
export async function submitAccessRequest(req: Request) {
  const actor = actorOf(req);
  assertCanApply(actor.status, actor.rejectedAt, actor.role);

  const data = accessRequestSchema.parse(req.body);
  const dbUser = await findUserById(actor.id);
  if (!dbUser) throw conflict("Account not found");

  const existing = await findOpenRequestForUser(dbUser.id);

  if (existing) {
    await db.transaction(async (tx) => {
      await tx
        .update(accessRequests)
        .set({
          name: data.name,
          email: data.email,
          boardId: data.boardId ?? null,
          levelId: data.levelId ?? null,
          note: data.note ?? null,
          requestedRole: data.requestedRole ?? existing.requestedRole,
        })
        .where(eq(accessRequests.id, existing.id));
      await setRequestSubjects(existing.id, data.subjectIds, tx);
    });
  } else {
    await createAccessRequest({
      userId: dbUser.id,
      name: data.name,
      email: data.email,
      boardId: data.boardId ?? null,
      levelId: data.levelId ?? null,
      subjectIds: data.subjectIds,
      note: data.note ?? null,
      requestedRole: data.requestedRole ?? null,
    });
  }

  await reopenRejectedAccount(dbUser);
}

/**
 * `POST /api/v1/me/request/parent` — one click for a guardian: same path as the
 * full form, only `requestedRole: "parent"` and no catalog fields.
 */
export async function requestParentAccess(req: Request) {
  const actor = actorOf(req);
  if (actor.status === "active") return;
  assertCanApply(actor.status, actor.rejectedAt, actor.role);

  const dbUser = await findUserById(actor.id);
  if (!dbUser) throw conflict("Account not found");

  const existing = await findOpenRequestForUser(dbUser.id);
  if (existing) {
    await db
      .update(accessRequests)
      .set({
        requestedRole: "parent",
        note: existing.note || "Requested from the parent sign-up page.",
      })
      .where(eq(accessRequests.id, existing.id));
  } else {
    await createAccessRequest({
      userId: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      boardId: null,
      levelId: null,
      subjectIds: [],
      note: "Requested from the parent sign-up page.",
      requestedRole: "parent",
    });
  }

  await reopenRejectedAccount(dbUser);
}


