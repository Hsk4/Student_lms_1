"use client";

import { useSearchParams } from "next/navigation";

/**
 * The "this account is suspended" banner on the landing page.
 *
 * It is the only part of the landing that needs the browser (it reads
 * `?error=account_suspended`), so it is the only part that is a client
 * component. Everything around it is server-rendered, which is what lets a
 * crawler see the page.
 */
export function SuspendedNotice() {
  const params = useSearchParams();
  if (params.get("error") !== "account_suspended") return null;

  return (
    <div className="bg-status-red-soft px-6 py-3 text-center text-sm font-medium text-status-red">
      This account is suspended. Contact the school office.
    </div>
  );
}
