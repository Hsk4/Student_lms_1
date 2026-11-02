"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-compat";
import { useMe } from "@/lib/queries";

/**
 * Keep authenticated visitors out of public entry pages. Login itself primes
 * the /me query and navigates directly to the API-provided role home, so this
 * also handles app relaunches with an existing local session.
 */
export function AuthRedirector() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !me.data) return;

    const isPublicEntryPage =
      pathname === "/" ||
      pathname === "/mobile" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up");

    if (isPublicEntryPage) {
      router.replace(me.data.home || "/pending");
    }
  }, [isLoaded, isSignedIn, me.data, pathname, router]);

  return null;
}
