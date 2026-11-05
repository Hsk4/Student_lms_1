"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { webHomeFor } from "@/lib/role-home";

/**
 * Keep authenticated visitors out of public entry pages. Sign-in loads the
 * profile and navigates to the API-provided role home, so this also handles
 * app relaunches with an existing local session.
 *
 * The destination goes through `webHomeFor`, so a parent lands on the link
 * page rather than the children dashboard (see `lib/role-home.ts`).
 */
export function AuthRedirector() {
  const { ready, signedIn, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !signedIn || !user) return;

    const isPublicEntryPage =
      pathname === "/" ||
      pathname === "/mobile" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up");

    if (isPublicEntryPage) {
      router.replace(webHomeFor(user.home));
    }
  }, [ready, signedIn, user, pathname, router]);

  return null;
}
