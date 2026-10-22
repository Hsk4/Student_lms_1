"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createParentLink } from "@/actions/parent";

/**
 * First-login step: record a guardian and issue a link code.
 *
 * No email is sent. The student shares the code with their guardian, who enters
 * it in their own panel once their account is approved.
 */
export function ParentOnboardingForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);

  if (issued) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your guardian uses this code to link to you. Share it with them
          directly — it is not emailed.
        </p>
        <p className="rounded-[var(--radius-card)] border border-primary bg-tint px-4 py-4 text-center font-mono text-3xl font-semibold tracking-[0.3em] text-tint-foreground">
          {issued.code}
        </p>
        <p className="text-xs text-muted-foreground">
          Valid for 14 days, one use. You can issue more codes later from Parent access.
        </p>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
          <p className="text-sm font-medium">Sending this to your guardian?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            They open the parent start page to create an account and ask for access. Approval
            usually takes a day.
          </p>
          <Link href="/sign-up/parent" className="btn-secondary mt-2 h-9" target="_blank">
            Open the parent start page
          </Link>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            router.push("/student");
            router.refresh();
          }}
        >
          Continue to my dashboard
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await createParentLink({
            parentName: form.get("parentName"),
            parentEmail: String(form.get("parentEmail") ?? "") || undefined,
          });
          if (!result.ok || !result.data) {
            setMessage(
              result.error ?? result.message ?? "Could not create a link code",
            );
          } else {
            setIssued(result.data);
          }
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not create a link code",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="parentName">
          Parent or guardian name
        </label>
        <input
          id="parentName"
          name="parentName"
          className="input"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
        />
      </div>
      <div>
        <label className="label" htmlFor="parentEmail">
          Their email{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="parentEmail"
          name="parentEmail"
          type="email"
          className="input"
          autoComplete="email"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          For your records only. The code is what links their account — no email
          is sent.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating code..." : "Create link code"}
        </button>
        {message ? (
          <span className="text-sm text-status-red">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
