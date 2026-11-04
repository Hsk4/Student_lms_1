"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiBaseUrl } from "@/lib/auth";

/**
 * Build sanity check, run once in the browser.
 *
 * `NEXT_PUBLIC_API_URL` is compiled in, so a production bundle that fell back
 * to localhost is a build mistake that no environment variable can fix. Say it
 * in the console (and in the UI, via `ApiHealthNotice`) instead of letting
 * every screen fail with an opaque connection error.
 */
export function ApiBaseUrlCheck() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const base = apiBaseUrl();
    if (!base.includes("localhost") && !base.includes("127.0.0.1")) return;
    console.error(
      "[api] This build calls %s. NEXT_PUBLIC_API_URL was not set when the bundle was compiled; rebuild with the hosted API URL.",
      base,
    );
  }, [pathname]);

  return null;
}
