'use client';

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Client-side redirect after auth completes.
 * Polls /api/status every 500ms to check if webhook has synced the user.
 * Redirects to the appropriate panel (parent, student, teacher, admin).
 */
export default function AuthRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Only poll on sign-in/sign-up pages
    if (!pathname?.includes("/sign-in") && !pathname?.includes("/sign-up")) return;

    let attempts = 0;
    const maxAttempts = 10; // 5 seconds (500ms × 10)

    const pollStatus = async () => {
      try {
        const res = await fetch("/api/status", {
          method: "GET",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.signedIn && data.home) {
            router.push(data.home);
            return;
          }
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(pollStatus, 500);
      }
    };

    pollStatus();
  }, [isLoaded, isSignedIn, pathname, router]);

  return null;
}
