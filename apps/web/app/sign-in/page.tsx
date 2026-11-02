"use client";

import { SignIn } from "@/lib/auth-compat";

/** Local-only sign-in page for the production demo. */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </div>
  );
}
