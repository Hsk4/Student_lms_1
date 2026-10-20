import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";

/** Signed-out visitors reach the marketing page; everyone else lands in their area. */
async function Gate({ error }: { error?: string }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <span className="text-lg font-semibold tracking-tight text-primary">
          Fastly LMS
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-secondary">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn-primary">
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
          <Link href="/sign-up" className="btn-primary">
            Create an account
          </Link>
          <Link href="/sign-in" className="btn-secondary">
            I already have one
          </Link>
        </div>
      </main>
    </div>
  );
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <Gate error={error} />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
