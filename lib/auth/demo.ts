import { headers } from "next/headers";
import type { UserRole } from "@/lib/types";

/**
 * Local demo sign-in.
 *
 * With `LMS_DEMO_ROLE` set, `proxy.ts` short-circuits a request whose
 * `__session` cookie is `demo_<role>` before Clerk's middleware runs, and the
 * unauthenticated paths below resolve that same value. Reading the role from
 * the cookie (not from the environment alone) keeps the fake session honest:
 * one browser cannot be signed in as two roles at once, and a cookie naming a
 * role that is not seeded simply resolves to no user.
 *
 * The demo user must exist in Postgres (`scripts/seed-demo-users.ts`) with the
 * matching `clerk_id`.
 */
export async function demoSession(): Promise<{
  clerkId: string;
  role: UserRole;
} | null> {
  if (!process.env.LMS_DEMO_ROLE) return null;

  // The proxy forwards the value it matched in `x-demo-session`, so the cookie
  // is read exactly once, in the proxy, and `headers()` (not `cookies()`) keeps
  // this helper cheap for the ordinary Clerk-authenticated requests.
  const requestHeaders = await headers();
  const session = requestHeaders.get("x-demo-session") ?? "";
  const match = /^demo_(super_admin|admin|teacher|student|parent)$/.exec(session);
  if (!match) return null;

  return { clerkId: session, role: match[1] as UserRole };
}
