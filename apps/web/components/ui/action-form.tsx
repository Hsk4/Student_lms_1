"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/nila";

/**
 * Moved client-side: the web calls the API through `lib/api-client`, so a
 * mutation returns `null` on success and throws on failure. `{ ok: false }` is
 * still accepted so older call sites keep working the same way.
 */
type Result = { ok: boolean; message?: string } | void | null;

/**
 * Form + result line. Every panel form uses it, so the feedback looks the same.
 *
 * Styled with the UI kit's `Button` and `Notice` rather than the legacy
 * `.btn-primary` classes: a disabled submit needs the kit's pointer-events
 * rule, and an error deserves more than a red sentence next to the button.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-3",
  submitLabel = "Save",
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <form
      className={className}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setPending(true);
        setResult(null);
        try {
          const state = await action(formData);
          setResult(state === null ? { ok: true } : state);
          const ok = state == null ? true : (state as { ok: boolean }).ok;
          if (ok && resetOnSuccess) form.reset();
        } catch (error) {
          setResult({
            ok: false,
            message: error instanceof Error ? error.message : "Request failed",
          });
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Working..." : submitLabel}
        </Button>
        {result ? (
          result.ok ? (
            <span className="text-sm font-medium text-status-green">Saved</span>
          ) : (
            <Notice tone="error">{result.message ?? "Request failed"}</Notice>
          )
        ) : null}
      </div>
    </form>
  );
}

/** Inline button for one-off actions (toggle, suspend, reinstate). */
export function ActionButton({
  action,
  children,
  confirm,
  tone = "secondary",
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: string;
  tone?: "secondary" | "ghost" | "danger";
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const variant =
    tone === "ghost" ? "ghost" : tone === "danger" ? "destructive" : "outline";

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setPending(true);
          setMessage(null);
          try {
            const state = await action();
            if (state && "ok" in state && !state.ok) {
              setMessage(state.message ?? "Failed");
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "..." : children}
      </Button>
      {message ? (
        <span className="text-xs text-status-red">{message}</span>
      ) : null}
    </span>
  );
}
