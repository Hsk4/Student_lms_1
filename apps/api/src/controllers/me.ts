import type { Request } from "express";
import { eq } from "drizzle-orm";
import {
  homeFor,
  type MeResponse,
  type RequestStatusResponse,
} from "@lms/shared";
import { db } from "@/db";
import { users } from "@/db/schema";
import { actorOf } from "@/middleware/auth";
import { countOpenRequests, findOpenRequestForUser } from "@/db/queries/access-requests";

/** `GET /api/v1/me` — the account the client renders its guards from. */
export async function me(req: Request): Promise<MeResponse> {
  const actor = actorOf(req);
  const pendingRequests =
    actor.role === "admin" || actor.role === "super_admin"
      ? await countOpenRequests()
      : 0;

  return {
    id: actor.id,
    clerkId: actor.clerkId,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    status: actor.status,
    onboarded: actor.onboarded,
    rejectedAt: actor.rejectedAt ? actor.rejectedAt.toISOString() : null,
    rejectionReason: actor.rejectionReason ?? null,
    home: homeFor(actor),
    pendingRequests,
  };
}

/** `GET /api/v1/me/request` — the pending/rejected page's status line. */
export async function myRequestStatus(
  req: Request,
): Promise<RequestStatusResponse> {
  const actor = actorOf(req);
  const open = await findOpenRequestForUser(actor.id);

  return {
    status: actor.status,
    role: actor.role,
    rejectionReason: actor.rejectionReason ?? null,
    rejectedAt: actor.rejectedAt
      ? new Date(actor.rejectedAt).toISOString()
      : null,
    hasOpenRequest: Boolean(open),
    requestedRole: open?.requestedRole ?? null,
  };
}

/** Used by the pending page's 5-second poll: the mirror row, fresh from Postgres. */
export async function freshStatus(req: Request) {
  const actor = actorOf(req);
  const [row] = await db
    .select({
      status: users.status,
      role: users.role,
      onboarded: users.onboarded,
    })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  return row ?? null;
}


