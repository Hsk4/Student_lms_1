'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type Result = { ok: boolean; message?: string } | void;

/** Form + result line. Every panel form uses it, so the feedback looks the same. */
export function ActionForm({
  action,
  children,
  className = 'space-y-3',
  submitLabel = 'Save',
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
          setResult(state);
          if (state?.ok && resetOnSuccess) form.reset();
        } catch (error) {
          setResult({
            ok: false,
            message: error instanceof Error ? error.message : 'Request failed',
          });
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Working...' : submitLabel}
        </button>
        {result ? (
          <span className={`text-sm ${result.ok ? 'text-status-green' : 'text-status-red'}`}>
            {result.ok ? 'Saved' : result.message}
          </span>
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
  tone = 'secondary',
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirm?: string;
  tone?: 'secondary' | 'ghost' | 'danger';
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const className =
    tone === 'ghost' ? 'btn-ghost' : tone === 'danger' ? 'btn-danger' : 'btn-secondary';

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setPending(true);
          setMessage(null);
          try {
            const state = await action();
            if (state && !state.ok) setMessage(state.message ?? "Failed");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Failed');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? '...' : children}
      </button>
      {message ? <span className="text-xs text-status-red">{message}</span> : null}
    </span>
  );
}
