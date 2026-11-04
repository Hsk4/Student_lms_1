"use client";

import { SignIn } from "@/lib/auth-compat";
import { BrandMark } from "@/components/brand/primitives";
import { SCHOOL_NAME } from "@/lib/school";

/**
 * Sign-in.
 *
 * The Clerk widget is still Clerk's (it owns the email/password and OAuth
 * flows), but it sits inside the same two-band shell as every gate page: a navy
 * jaali strip with the mark, and a white 30px sheet. Centring a bare widget on
 * grey made sign-in look like a different product.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-2 px-4 py-10 text-center sm:py-12">
          <BrandMark size={52} tone="light" />
          <p className="fastly-display mt-2 text-[26px] leading-tight text-white sm:text-[30px]">
            Welcome back
          </p>
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-on-navy-soft">
            Sign in to {SCHOOL_NAME} to see your classes, work and fees.
          </p>
        </div>
      </header>

      <main className="relative -mt-7 flex flex-1 justify-center px-4 pb-12">
        <div className="fastly-sheet w-full max-w-md border-[1.5px] border-line bg-card px-4 py-6 sm:px-7">
          <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
        </div>
      </main>
    </div>
  );
}
