"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Simple redirect after status changes from pending.
 * Called once on mount to check if user's status is no longer pending.
 */
export function PendingPoller() {
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();

        // If status is no longer pending, redirect
        if (data.status !== "pending") {
          // Reload session and navigate
          const clerk = (
            window as unknown as {
              Clerk?: { session?: { reload: () => Promise<void> } };
            }
          ).Clerk;
          await clerk?.session?.reload();
          router.refresh();
          router.push(data.home);
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }
    };

    // Single check on mount
    checkStatus();
  }, [router]);

  return null;
}
