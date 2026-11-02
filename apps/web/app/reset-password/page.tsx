"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to reset password");
      setMessage(payload.data?.message ?? "Your password has been reset. Please sign in again.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => router.replace("/sign-in/"), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your reset link is valid for 30 minutes and can only be used once.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">New password</span>
          <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Confirm new password</span>
          <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-foreground">{message}</p> : null}
        <button disabled={busy} type="submit" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground"><Link href="/sign-in/" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reset form...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
