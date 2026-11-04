/**
 * Roles, statuses and the one place that decides where an account may land.
 *
 * Shared by the API (guards) and the web (route guards are UX only; the API is
 * the real gate). Missing metadata is treated as `pending`.
 */

export const USER_ROLES = [
  "super_admin",
  "admin",
  "teacher",
  "student",
  "parent",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  "pending",
  "active",
  "rejected",
  "suspended",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

/** The account as the gate sees it, before any record-level check. */
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

/** The one place that decides where an account may land. */
export function homeFor(user: {
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
}): string {
  if (user.status === "suspended") return "/?error=account_suspended";

  /*
   * `pending` only gates accounts that are waiting to be *given* something.
   * An account that already holds a role was seeded or assigned by an admin —
   * the role is the approval — so it goes straight to its panel. Only a
   * pending account with no role is actually waiting on the office.
   */
  if (user.status === "pending" && !user.role) return "/pending";
  if (user.status === "rejected" && !user.role) return "/rejected";

  if (user.role === "student" && !user.onboarded) return "/onboarding/parent";
  if (!user.role) return "/request";
  return ROLE_HOME[user.role];
}
