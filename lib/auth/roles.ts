import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import { User, type UserStatus } from "@/models/user";

export type UserRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent";

export interface SessionClaims {
  metadata?: {
    role?: UserRole | null;
    status?: UserStatus;
    onboarded?: boolean;
  };
}

export interface SessionUser {
  clerkId: string;
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
}

export interface GateUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
}

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

/** Session claims only. Missing metadata is treated as pending. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId, sessionClaims } = await auth();

  if (!userId) return null;

  const claims = sessionClaims as SessionClaims | null | undefined;

  return {
    clerkId: userId,
    role: claims?.metadata?.role ?? null,
    status: claims?.metadata?.status ?? "pending",
    onboarded: claims?.metadata?.onboarded ?? false,
  };
}

/**
 * Reads the Mongo mirror. If the webhook has not landed yet, the account is
 * adopted from Clerk so a fresh sign-up is never stuck on a missing user.
 */
export async function getCurrentUser(): Promise<GateUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();
  let dbUser = await User.findOne({ clerkId: userId }).lean();

  if (!dbUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "User";
    dbUser = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $setOnInsert: {
          clerkId: userId,
          email,
          name,
          role: null,
          status: "pending",
          onboarded: false,
        },
      },
      { upsert: true, returnDocument: "after", lean: true },
    );
  }

  if (!dbUser) return null;

  return {
    id: String(dbUser._id),
    clerkId: dbUser.clerkId,
    email: dbUser.email,
    name: dbUser.name,
    role: (dbUser.role ?? null) as UserRole | null,
    status: dbUser.status as UserStatus,
    onboarded: Boolean(dbUser.onboarded),
    rejectionReason: dbUser.rejectionReason ?? null,
    rejectedAt: dbUser.rejectedAt ?? null,
  };
}

/** The one place that decides where an account may land. */
export function homeFor(user: {
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
}): string {
  if (user.status === "pending") return "/pending";
  if (user.status === "rejected") return "/rejected";
  if (user.status === "suspended") return "/?error=account_suspended";
  if (user.role === "student" && !user.onboarded) return "/onboarding/parent";
  if (!user.role) return "/request";
  return ROLE_HOME[user.role];
}

/** Redirects a signed-out visitor to sign-in. */
export async function requireSignedIn(): Promise<GateUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * Coarse panel guard. Available roles for the area; returns where to send the
 * user when they are not allowed in. Used by layouts and by every server action.
 */
export async function checkAccess(
  allowedRoles: UserRole[],
): Promise<{ user: GateUser; redirectTo: string | null }> {
  const user = await requireSignedIn();

  if (
    user.status !== "active" ||
    !user.role ||
    !allowedRoles.includes(user.role)
  ) {
    return { user, redirectTo: homeFor(user) };
  }

  return { user, redirectTo: null };
}

export async function getUserFromDB(clerkId: string) {
  await connectDB();
  return User.findOne({ clerkId }).lean();
}
