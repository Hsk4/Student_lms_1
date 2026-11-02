"use client";

import { SignUp } from "@/lib/auth-compat";

/** Local-only sign-up page for the production demo. */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </div>
  );
}
