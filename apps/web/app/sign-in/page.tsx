"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SignIn } from "@/lib/auth";
import { BrandMark } from "@/components/brand/primitives";
import { ThemeToggle } from "@/components/shell/page-actions";
import { Button } from "@/components/ui/button";
import { SCHOOL_NAME } from "@/lib/school";
import { SignInNotice } from "./sign-in-notice";

/**
 * Sign-in.
 *
 * Local email/password authentication against the API. It sits inside the same
 * two-band shell as every gate page: a navy jaali strip with the mark, and a
 * white 30px sheet. Centring a bare form on grey made sign-in look like a
 * different product.
 *
 * The form is deliberately one form for every role — the API decides where the
 * account lands — but the page also carries the three doors, so a parent
 * arriving from the landing page can see "parent" named here and, if they have
 * no account yet, goes straight to the parent application instead of guessing
 * which generic sign-up to use.
 */

const DOORS = [
  {
    role: "Student",
    href: "/sign-up?role=student",
    hint: "Classes and homework",
  },
  { role: "Parent", href: "/sign-up/parent", hint: "Your child's progress" },
  {
    role: "Teacher",
    href: "/sign-up?role=teacher",
    hint: "Teaching application",
  },
] as const;

function Body() {
  const search = useSearchParams();
  /*
   * `?role=parent` highlights the parent door. It is a hint for the person
   * arriving, never an authorization: whichever form is used, `/me` decides
   * what the account may see.
   */
  const role = search.get("role");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        {/* Theme control, top-right: the gate pages have no panel header. */}
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-5">
          <ThemeToggle tone="onNavy" />
        </div>
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

      <main className="relative -mt-7 flex flex-1 items-start justify-center px-4 pb-12">
        <div className="fastly-sheet self-start w-full max-w-md border-[1.5px] border-line bg-card px-4 py-6 sm:px-7">
          <SignInNotice />
          <SignIn signUpUrl="/sign-up" />

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              New here?
            </p>
            <div className="mt-3 grid gap-2">
              {DOORS.map((door) => {
                const active = role === door.role.toLowerCase();
                return (
                  <Button
                    key={door.role}
                    asChild
                    variant="outline"
                    className={`h-auto justify-between py-2.5 ${
                      active
                        ? "border-primary bg-tint text-tint-foreground"
                        : ""
                    }`}
                  >
                    <Link href={door.href}>
                      <span className="font-semibold">{door.role}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {door.hint}
                      </span>
                    </Link>
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Parents are reviewed by the school office before their dashboard
              opens.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  // `useSearchParams` needs a Suspense boundary in the static (mobile) export.
  return (
    <Suspense fallback={null}>
      <Body />
    </Suspense>
  );
}
