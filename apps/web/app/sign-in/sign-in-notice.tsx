"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Messages the app itself can hand the sign-in page. `?reason=session_expired`
 * is set when a request came back 401, so a dropped session explains itself
 * instead of looking like a crash.
 */
const REASONS: Record<string, string> = {
  session_expired: "Your session has expired. Please sign in again.",
};

function Notice() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const text = reason ? REASONS[reason] : null;
  if (!text) return null;

  return (
    <p
      role="status"
      className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
    >
      {text}
    </p>
  );
}

export function SignInNotice() {
  // `useSearchParams` needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}
