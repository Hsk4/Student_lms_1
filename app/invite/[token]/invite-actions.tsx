"use client";

import Link from "next/link";

/** Clerk owns the invitation URL and sign-up flow; this route is informational only. */
export function InviteActions() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Use the invitation email from Clerk to finish sign-up with the invited address. The webhook links your parent account to the student.
      </p>
      <Link href="/sign-in" className="btn-primary">Go to sign in</Link>
    </div>
  );
}
