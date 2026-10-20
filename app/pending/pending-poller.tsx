"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StatusResponse = {
  signedIn: boolean;
  status: string;
  home: string;
};

/**
 * Polls /api/status every five seconds. When the status leaves pending the
 * session is reloaded and the user is sent to the area their role unlocks.
 */
export function PendingPoller() {
  const router = useRouter();
  const [note, setNote] = useState("Checking every 5 seconds...");

  useEffect(() => {
    let stopped = false;

    async function check() {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as StatusResponse;
        if (stopped) return;

        if (data.status !== "pending") {
          setNote("Status changed. Opening your panel...");
          // Claims live in the session token, so reload the session before navigating.
          const clerk = (
            window as unknown as {
              Clerk?: { session?: { reload: () => Promise<void> } };
            }
          ).Clerk;
          await clerk?.session?.reload();
          router.refresh();
          router.push(data.home);
        }
      } catch {
        setNote("Connection issue. Still trying...");
      }
    }

    const timer = setInterval(check, 5000);
    check();

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  return <p className="mt-4 text-xs text-muted-foreground">{note}</p>;
}
