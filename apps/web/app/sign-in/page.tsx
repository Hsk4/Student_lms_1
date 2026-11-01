"use client";

import { SignIn } from "@clerk/clerk-react";
import { AuthRedirector } from "@/views/layout/auth-redirector";

/**
 * Static export has no catch-all routes, so `/sign-in` is one page. Clerk's
 * `path` routing needs a catch-all, so it is not used here; `AuthRedirector`
 * sends a signed-in visitor to their role home.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <AuthRedirector />
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </div>
  );
}
