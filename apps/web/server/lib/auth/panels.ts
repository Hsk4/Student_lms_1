import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getCurrentUser, homeFor, type GateUser } from "@/lib/auth/roles";

/**
 * Coarse panel guard for a role area. Mirrors `checkAccess` but returns the
 * full Mongo user, which the panel shell needs for the header.
 *
 * The panel guard gates the area; each page still applies its own row guard,
 * and every server action re-checks with `requireRole`.
 */
export async function requirePanelUser(
  role: "student" | "teacher" | "parent",
): Promise<GateUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.status !== "active" || user.role !== role) {
    redirect(homeFor(user));
  }

  // A student without a linked parent can only reach onboarding.
  if (role === "student" && !user.onboarded) redirect("/onboarding/parent");

  return user;
}

/**
 * Opts a panel page out of static prerendering. The page reads the session and
 * the database, and renders current dates, so it must render per request.
 * Must be the first await in the page.
 */
export async function requireRequestTime(): Promise<void> {
  await connection();
}

/** The current pathname, for highlighting the active sidebar item. */
export async function currentPathname(): Promise<string | undefined> {
  if (process.env.NODE_ENV === "production") return undefined;
  const requestHeaders = await headers();
  return requestHeaders.get("x-pathname") ?? undefined;
}
