"use server";

import { revalidatePath } from "next/cache";
import { createClerkClient } from "@clerk/backend";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/roles";
import {
  createAccessRequest,
  findOpenRequestForUser,
  setRequestSubjects,
} from "@/lib/queries/access-requests";
import { findUserById, updateUser } from "@/lib/queries/users";
import { accessRequestSchema } from "@/lib/validators/admin";
import type { UserRole, UserStatus } from "@/lib/types";
import { accessRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

export type RequestResult = { ok: boolean; message?: string };

const clerkSecret = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecret
  ? createClerkClient({ secretKey: clerkSecret })
  : null;

function reapplyDateOf(rejectedAt: Date | null | undefined): Date | null {
  if (!rejectedAt) return null;
  const reapplyAt = new Date(rejectedAt);
  reapplyAt.setDate(reapplyAt.getDate() + 30);
  return reapplyAt;
}

/**
 * A pending or rejected account files an access request. Rejected users may
 * re-apply 30 days after rejectedAt; the request moves the account back to pending.
 */
export async function submitAccessRequest(
  raw: unknown,
): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first" };
  if (user.status === "active") {
    return { ok: false, message: "Your account is already active" };
  }

  if (user.status === "suspended") {
    return { ok: false, message: "Your account is suspended" };
  }

  const data = accessRequestSchema.parse(raw);

  const reapplyAt = reapplyDateOf(user.rejectedAt);
  if (user.status === "rejected" && reapplyAt && reapplyAt > new Date()) {
    return {
      ok: false,
      message: `You may re-apply from ${reapplyAt.toISOString().slice(0, 10)}`,
    };
  }

  const dbUser = await findUserById(user.id);
  if (!dbUser) return { ok: false, message: "Account not found" };

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

  if (dbUser.status === "rejected" && !clerk) {
    return { ok: false, message: "Admin metadata sync is not configured" };
  }

  // Re-applying puts the account back in the pending queue; the admin re-decides.
  if (dbUser.status === "rejected" && clerk) {
    const oldMetadata = {
      role: dbUser.role ?? null,
      status: dbUser.status,
      onboarded: dbUser.onboarded,
    };
    await clerk.users.updateUser(dbUser.clerkId, {
      publicMetadata: {
        role: dbUser.role ?? null,
        status: "pending",
        onboarded: dbUser.onboarded,
      },
    });
    try {
      await updateUser(dbUser.id, {
        status: "pending",
        rejectedAt: null,
        rejectionReason: null,
      });
    } catch (error) {
      await clerk.users.updateUser(dbUser.clerkId, {
        publicMetadata: oldMetadata,
      });
      throw error;
    }
  }

  revalidatePath("/pending");
  revalidatePath("/request");
  revalidatePath("/admin/requests");

  return { ok: true };
}

export type RequestStatus = {
  status: string;
  role: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  hasOpenRequest: boolean;
  /** The role the open request asked for, so the pending page can guide. */
  requestedRole: string | null;
};

export async function getOwnRequestStatus(): Promise<RequestStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const open = await findOpenRequestForUser(user.id);

  return {
    status: user.status,
    role: user.role,
    rejectionReason: user.rejectionReason ?? null,
    rejectedAt: user.rejectedAt
      ? new Date(user.rejectedAt).toISOString()
      : null,
    hasOpenRequest: Boolean(open),
    requestedRole: open?.requestedRole ?? null,
  };
}

/**
 * One click for a guardian: file the access request asking for the parent role.
 *
 * A parent has nothing to pick from the catalog, so the full `/request` form is
 * friction for them. This goes through the same path (`pending` account, an open
 * `AccessRequest`, an admin decision, the 30-day re-apply rule) — it only skips
 * the fields that do not apply, and records `requestedRole: "parent"` so the
 * admin queue pre-selects the right role.
 */
export async function requestParentAccess(): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first" };
  if (user.status === "active") return { ok: true };
  if (user.status === "suspended") {
    return { ok: false, message: "Your account is suspended" };
  }

  const reapplyAt = reapplyDateOf(user.rejectedAt);
  if (user.status === "rejected" && reapplyAt && reapplyAt > new Date()) {
    return {
      ok: false,
      message: `You may re-apply from ${reapplyAt.toISOString().slice(0, 10)}`,
    };
  }

  const dbUser = await findUserById(user.id);
  if (!dbUser) return { ok: false, message: "Account not found" };

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

  if (dbUser.status === "rejected") {
    if (!clerk) {
      return { ok: false, message: "Admin metadata sync is not configured" };
    }
    await clerk.users.updateUser(dbUser.clerkId, {
      publicMetadata: {
        role: dbUser.role ?? null,
        status: "pending",
        onboarded: dbUser.onboarded,
      },
    });
    await updateUser(dbUser.id, {
      status: "pending" as UserStatus,
      rejectedAt: null,
      rejectionReason: null,
    });
  }

  revalidatePath("/pending");
  revalidatePath("/sign-up/parent");
  revalidatePath("/admin/requests");
  return { ok: true };
}

/** Kept so callers that imported the role type from here keep compiling. */
export type { UserRole };
