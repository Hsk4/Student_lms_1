"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/** The public landing page. A signed-in visitor is sent home by `AuthRedirector`. */
function Landing() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <span className="text-lg font-semibold tracking-tight text-primary">
          Fastly LMS
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        {error === "account_suspended" ? (
          <p className="rounded-[var(--radius-card)] border border-status-red bg-status-red-soft px-3 py-2 text-sm text-status-red">
            This account is suspended. Contact the school office.
          </p>
        ) : null}

        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          One school. Students, parents and teachers in one place.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Sign up, tell us which board and level you study, and an admin will
          activate your account. Nobody picks their own role.
        </p>
        <div className="flex gap-3">
          <Link
            href="/sign-up"
            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover"
          >
            Create an account
          </Link>
          <Link
            href="/sign-in"
            className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
          >
            I already have one
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          A parent or guardian?{" "}
          <Link
            href="/sign-up/parent"
            className="font-medium text-primary hover:underline"
          >
            Start here
          </Link>{" "}
          — you only need to ask for access.
        </p>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Landing />
    </Suspense>
  );
}
