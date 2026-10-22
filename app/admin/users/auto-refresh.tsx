"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the user list when the admin comes back to the tab.
 *
 * The list is a server component, so `router.refresh()` re-runs it on the
 * server. This fires only on `visibilitychange` and `focus` — browser events,
 * not an interval — so an idle admin tab costs nothing and there is no polling
 * loop. A stale tab that is left open but never focused simply shows what it
 * last rendered, which is the same as any other server-rendered page.
 *
 * There is no push channel: Next 16.3 closes WebSocket upgrades for app and
 * pages routes (`router-server.js`: "TODO: allow upgrade requests to
 * pages/app paths?"), and Socket.IO's long-polling fallback hid that. If live
 * push is needed later, it requires a custom Node server that owns the
 * `upgrade` event — not a polling workaround.
 */
export function UsersAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
