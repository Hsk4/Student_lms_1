import type { UserRole } from "@lms/shared";

/**
 * Where each role's panel lives, for the web app.
 *
 * This mirrors `ROLE_HOME` in `@lms/shared`, with one deliberate difference:
 * a parent lands on `/parent/link` rather than `/parent`.
 *
 * Why: a parent is approved *before* they are linked to a child. `/parent`
 * (the children dashboard) is a read-only view of linked children, so a
 * freshly approved parent would open an empty page and have to find "Link a
 * child" in the sidebar. `/parent/link` is the one action they actually need
 * first, and it is also where the sign-up flow tells them to go. Once a child
 * is linked, the dashboard is one tap away.
 *
 * The API's `/me` still returns the shared `home`; this is the web's own
 * landing rule, used wherever the app decides "where does this account go".
 */
export const WEB_ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent/link",
};

/**
 * The web landing page for an account, given the API's `home`.
 *
 * `home` is authoritative for everything except the parent panel: the API
 * cannot know whether this parent has linked a child yet, and the web wants
 * every parent to start at the link page. Every other value is passed through
 * untouched, so pending/rejected/onboarding/suspended routing is unchanged.
 */
export function webHomeFor(home: string | null | undefined): string {
  if (!home) return "/pending";
  if (home === "/parent") return WEB_ROLE_HOME.parent;
  return home;
}
