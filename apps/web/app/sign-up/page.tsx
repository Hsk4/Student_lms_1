"use client";

import { SignUp } from "@clerk/clerk-react";
import { AuthRedirector } from "@/views/layout/auth-redirector";

/** One static page: see the note on `/sign-in`. */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <AuthRedirector />
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </div>
  );
}
