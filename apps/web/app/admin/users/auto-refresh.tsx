"use client";

import { useEffect } from "react";

/**
 * Re-fetches the user list when the admin comes back to the tab. Fires only on
 * `visibilitychange` and `focus`, never on an interval.
 */
export function UsersAutoRefresh({ onRefresh }: { onRefresh: () => void }) {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") onRefresh();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [onRefresh]);

  return null;
}
