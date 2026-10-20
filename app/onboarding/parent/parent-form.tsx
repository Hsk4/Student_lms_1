"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createParentInvite } from "@/actions/parent";

export function ParentOnboardingForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await createParentInvite({
            parentName: form.get("parentName"),
            parentEmail: form.get("parentEmail"),
          });
          if (!result.ok) {
            setMessage(result.message ?? "Could not create invite");
          } else {
            setMessage("Clerk sent the invitation email. Your parent should check their inbox.");
            router.push("/student");
            router.refresh();
          }
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Could not create invite",
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
          Parent&apos;s email
        </label>
        <input
          id="parentEmail"
          name="parentEmail"
          type="email"
          className="input"
          autoComplete="email"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Clerk will send the invitation email. They must sign up with this verified email.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating invite..." : "Create parent invite"}
        </button>
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>

    </form>
  );
}
