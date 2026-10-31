import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { demoSession } from "@/lib/auth/demo";
import { findUserByClerkId, createUser } from "@/lib/queries/users";
import type { Student, UserRole, UserStatus } from "@/lib/types";

/**
 * Session and account resolution. Postgres-backed.
 *
 * `UserRole` / `UserStatus` now come from `lib/types` rather than being declared
 * here and re-declared on the Mongoose model, so there is one definition and it
 * matches the Postgres enums exactly.
 */

export type { UserRole, UserStatus };

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
  // Same demo bypass as `getCurrentUser`, resolved before `auth()` because
  // `proxy.ts` skips Clerk for demo requests.
  const demo = await demoSession();
  if (demo) {
    return {
      clerkId: demo.clerkId,
      role: demo.role,
      status: "active",
      onboarded: true,
    };
  }

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

function toGateUser(user: Student): GateUser {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    onboarded: user.onboarded,
    rejectionReason: user.rejectionReason,
    rejectedAt: user.rejectedAt,
  };
}

/**
 * Reads the Postgres mirror. If the webhook has not landed yet, the account is
 * adopted from Clerk so a fresh sign-up is never stuck on a missing user.
 */
export async function getCurrentUser(): Promise<GateUser | null> {
  // Screenshot-only bypass: seed a User with clerkId "demo_<role>" and set
  // LMS_DEMO_ROLE to render that panel without a Clerk session. `proxy.ts`
  // skips Clerk for these requests, so `auth()` must not be called here — it
  // throws when clerkMiddleware did not run.
  const demo = await demoSession();
  if (demo) {
    const demoUser = await findUserByClerkId(demo.clerkId);
    if (demoUser) return toGateUser(demoUser);
  }

  const { userId } = await auth();
  if (!userId) return null;

  let dbUser = await findUserByClerkId(userId);

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

    // Was `findOneAndUpdate(..., { upsert: true, $setOnInsert })`. The plain
    // insert now relies on `users_clerk_id_unique`; a concurrent webhook that
    // won the race makes this a 23505, which we absorb by re-reading.
    try {
      dbUser = await createUser({
        clerkId: userId,
        email,
        name,
        role: null,
        status: "pending",
        onboarded: false,
      });
    } catch {
      dbUser = await findUserByClerkId(userId);
    }
  }

  return dbUser ? toGateUser(dbUser) : null;
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
  return findUserByClerkId(clerkId);
}
