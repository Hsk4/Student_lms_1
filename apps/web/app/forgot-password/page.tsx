"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/primitives";
import { ThemeToggle } from "@/components/shell/page-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to request a reset link");
      setMessage(payload.data?.message ?? "If an account exists for that email, a password reset link will be sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request a reset link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-5">
          <ThemeToggle tone="onNavy" />
        </div>
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-2 px-4 py-10 text-center">
          <BrandMark size={48} tone="light" />
          <p className="fastly-display mt-2 text-[24px] text-white">Reset your password</p>
        </div>
      </header>

      <main className="relative -mt-7 flex flex-1 items-start justify-center px-4 pb-12">
        <section className="fastly-sheet self-start w-full max-w-md border-[1.5px] border-line bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Enter the email address on your school account. If it exists, we
            &apos;ll send you a one-time reset link.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block text-sm text-foreground">
              <span className="mb-1.5 block font-medium">Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input" placeholder="you@school.edu" />
            </label>
            {error ? <p role="alert" className="text-sm text-status-red">{error}</p> : null}
            {message ? <p role="status" className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">{message}</p> : null}
            <button disabled={busy} type="submit" className="fastly-primary w-full disabled:opacity-60">
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href="/sign-in/" className="font-semibold text-cobalt hover:underline">
              Back to sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
