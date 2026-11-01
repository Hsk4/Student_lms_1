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
  if (user.status === "pending") return "/pending";
  if (user.status === "rejected") return "/rejected";
  if (user.status === "suspended") return "/?error=account_suspended";
  if (user.role === "student" && !user.onboarded) return "/onboarding/parent";
  if (!user.role) return "/request";
  return ROLE_HOME[user.role];
}
