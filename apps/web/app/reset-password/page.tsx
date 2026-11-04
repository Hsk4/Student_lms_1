"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import { BrandMark } from "@/components/brand/primitives";
import { ThemeToggle } from "@/components/shell/page-actions";

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
    <section className="fastly-sheet self-start w-full max-w-md border-[1.5px] border-line bg-card p-6">
      <p className="text-sm text-muted-foreground">Your reset link is valid for 30 minutes and can only be used once.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block font-medium">New password</span>
          <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="input" />
        </label>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block font-medium">Confirm new password</span>
          <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input" />
        </label>
        {error ? <p role="alert" className="text-sm text-status-red">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">{message}</p> : null}
        <button disabled={busy} type="submit" className="fastly-primary w-full disabled:opacity-60">
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/sign-in/" className="font-semibold text-cobalt hover:underline">
          Back to sign in
        </Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-5">
          <ThemeToggle tone="onNavy" />
        </div>
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-2 px-4 py-10 text-center">
          <BrandMark size={48} tone="light" />
          <p className="fastly-display mt-2 text-[24px] text-white">
            Choose a new password
          </p>
        </div>
      </header>

      <main className="relative -mt-7 flex flex-1 items-start justify-center px-4 pb-12">
        <Suspense
          fallback={
            <div className="fastly-sheet self-start w-full max-w-md border-[1.5px] border-line bg-card p-6 text-sm text-muted-foreground">
              Loading reset form...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
