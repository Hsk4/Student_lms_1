"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/queries";

/**
 * After sign-in or sign-up, send the user to their role home from `GET /me`.
 * Also bounces a signed-in visitor away from the auth pages. UX only: the API
 * remains the gate.
 */
export function AuthRedirector() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !me.data) return;
    const onAuthPage =
      pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
    if (!onAuthPage) return;

    // A single check after a brief delay lets the webhook land.
    const timeout = setTimeout(() => router.replace(me.data.home), 500);
    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn, me.data, pathname, router]);

  return null;
}
