"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

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
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the email address on your school account. If it exists, we&apos;ll send you a one-time reset link.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-foreground">
            <span className="mb-1.5 block">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" placeholder="you@school.edu" />
          </label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-foreground">{message}</p> : null}
          <button disabled={busy} type="submit" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground"><Link href="/sign-in/" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </section>
    </main>
  );
}
