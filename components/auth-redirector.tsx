'use client';

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Client-side redirect after auth completes.
 * Polls /api/status once after sign-in/sign-up to check if webhook synced the user.
 * If no role yet, user can sign out and back in after admin assigns role.
 */
export default function AuthRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Only run on auth pages
    if (!pathname?.includes("/sign-in") && !pathname?.includes("/sign-up")) return;

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/status", {
          method: "GET",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.signedIn && data.home) {
            router.push(data.home);
          }
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }
    };

    // Single check after a brief delay to let webhook process
    const timeout = setTimeout(checkStatus, 500);
    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn, pathname, router]);

  return null;
}
