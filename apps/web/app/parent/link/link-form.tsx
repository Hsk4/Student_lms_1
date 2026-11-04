"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

/** The parent types the code their child gave them. */
export function RedeemLinkCodeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ id: string; name: string } | null>(
    null,
  );

  if (linked) {
    return (
      <div className="space-y-3">
        <p className="rounded-[var(--radius-card)] border border-status-green bg-status-green-soft px-3 py-2 text-sm text-status-green">
          Linked to {linked.name}. You can now see their progress and fees.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            // The detail page fetches the child itself on mount.
            router.push(`/parent/children/detail?id=${linked.id}`);
          }}
        >
          Open {linked.name}
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            const result = await api.post<{ id: string; name: string }>(
              "/parent/parent-links/redeem",
              { code: form.get("code") },
            );
            setLinked(result);
          } catch (redeemError) {
            setError(
              redeemError instanceof Error ? redeemError.message : "That code did not work",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="link-code">
          Link code from your child
        </label>
        <input
          id="link-code"
          name="code"
          className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
          placeholder="ABCD-EFGH"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={24}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Checking..." : "Link child"}
      </button>
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
    </form>
  );
}
