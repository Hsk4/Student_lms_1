"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Re-fetches the user list when the admin comes back to the tab. Fires only on
 * `visibilitychange` and `focus`, never on an interval.
 */
export function UsersAutoRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      }
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [queryClient]);

  return null;
}
