"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Keep authenticated visitors out of public entry pages. Sign-in loads the
 * profile and navigates to the API-provided role home, so this also handles
 * app relaunches with an existing local session.
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
      router.replace(user.home || "/pending");
    }
  }, [ready, signedIn, user, pathname, router]);

  return null;
}
