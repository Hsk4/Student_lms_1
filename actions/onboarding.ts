"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { createClerkClient } from "@clerk/backend";
import { AccessRequest } from "@/models/access-request";
import { getCurrentUser } from "@/lib/auth/roles";
import { accessRequestSchema } from "@/lib/validators/admin";

export type RequestResult = { ok: boolean; message?: string };

const clerkSecret = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecret ? createClerkClient({ secretKey: clerkSecret }) : null;

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

  if (user.status === "rejected" && user.rejectedAt) {
    const reapplyAt = new Date(user.rejectedAt);
    reapplyAt.setDate(reapplyAt.getDate() + 30);
    if (reapplyAt > new Date()) {
      return {
        ok: false,
        message: `You may re-apply from ${reapplyAt.toISOString().slice(0, 10)}`,
      };
    }
  }

  await connectDB();

  const dbUser = await User.findById(user.id);
  if (!dbUser) return { ok: false, message: "Account not found" };

  const existing = await AccessRequest.findOne({
    userId: dbUser._id,
    state: "open",
  });

  if (existing) {
    existing.name = data.name;
    existing.email = data.email;
    existing.boardId = data.boardId ?? undefined;
    existing.levelId = data.levelId ?? undefined;
    existing.subjectIds = data.subjectIds;
    existing.note = data.note;
    await existing.save();
  } else {
    await AccessRequest.create({
      userId: dbUser._id,
      name: data.name,
      email: data.email,
      boardId: data.boardId,
      levelId: data.levelId,
      subjectIds: data.subjectIds,
      note: data.note,
      state: "open",
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
      publicMetadata: { role: dbUser.role ?? null, status: "pending", onboarded: dbUser.onboarded },
    });
    try {
      dbUser.status = "pending";
      dbUser.rejectedAt = undefined;
      dbUser.rejectionReason = undefined;
      await dbUser.save();
    } catch (error) {
      await clerk.users.updateUser(dbUser.clerkId, { publicMetadata: oldMetadata });
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
};

export async function getOwnRequestStatus(): Promise<RequestStatus | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectDB();
  const open = await AccessRequest.exists({ userId: user.id, state: "open" });

  return {
    status: user.status,
    role: user.role,
    rejectionReason: user.rejectionReason ?? null,
    rejectedAt: user.rejectedAt
      ? new Date(user.rejectedAt).toISOString()
      : null,
    hasOpenRequest: Boolean(open),
  };
}
