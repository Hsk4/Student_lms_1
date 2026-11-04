"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/**
 * The single action a guardian needs: ask for the parent role.
 *
 * It files the same `AccessRequest` the full form files, just without board,
 * level and subjects, which do not apply to a parent.
 */
export function RequestParentRoleButton({
  reapplyAt,
}: {
  reapplyAt?: string | null;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (reapplyAt) {
    return (
      <p className="rounded-[var(--radius-card)] border border-status-amber bg-status-amber-soft px-3 py-2 text-sm text-status-amber">
        You can ask again from {reapplyAt}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await api.post("/me/request/parent");
              await refresh();
              router.push("/pending");
            } catch (requestError) {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : "Could not send the request",
              );
            }
          });
        }}
      >
        {pending ? "Sending..." : "Ask for parent access"}
      </button>
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
    </div>
  );
}

/** Used on the pending page once the request is in. */
export function ParentNextStep() {
  return (
    <Link href="/parent/link" className="btn btn-primary">
      Enter my child&apos;s code
    </Link>
  );
}
