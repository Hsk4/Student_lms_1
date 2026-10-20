'use client';

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Client-side redirect after auth completes.
 * Polls /api/status to check if webhook has synced the user and their role.
 * Redirects to the appropriate panel (parent, student, teacher, admin).
 * Handles sign-up completion, invite acceptance, and role changes.
 */
export default function AuthRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    // Poll on auth pages AND home page (where Clerk redirects after sign-up)
    const shouldPoll = 
      pathname?.includes("/sign-in") || 
      pathname?.includes("/sign-up") || 
      pathname === "/" ||
      pathname?.includes("/invite/");

    if (!shouldPoll) return;

    setIsRedirecting(true);
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds (500ms × 20) for slower webhooks

    const pollStatus = async () => {
      try {
        const res = await fetch("/api/status", {
          method: "GET",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          // Check if user has a role assigned (webhook has processed)
          if (data.signedIn && data.role && data.home) {
            setIsRedirecting(false);
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
      } else {
        // Max attempts reached, show error or let user proceed
        setIsRedirecting(false);
      }
    };

    // Start polling immediately
    pollStatus();
  }, [isLoaded, isSignedIn, userId, pathname, router]);

  // Show a subtle loading state while redirecting
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 pointer-events-none">
        <div className="rounded-lg border border-border bg-background p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary"></div>
            <p className="text-sm text-muted-foreground">Setting up your account...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
