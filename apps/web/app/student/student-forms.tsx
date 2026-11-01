"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** Every student mutation refreshes the student panel's queries. */
function useStudentRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["student"] });
}

/** One button per (teacher, course) pair in the teacher picker. */
export function RequestTeacherForm({
  teacherId,
  courseId,
  disabled,
  disabledReason,
}: {
  teacherId: string;
  courseId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const refresh = useStudentRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover h-9"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              await api.post("/student/enrollments", { teacherId, courseId });
              setMessage("Request sent.");
              await refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not send request");
            }
          });
        }}
      >
        {pending ? "Sending..." : "Request"}
      </button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </span>
  );
}

export function SubmitAssignmentForm({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const refresh = useStudentRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover h-9"
        onClick={() => setOpen(true)}
      >
        Submit work
      </button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post("/student/submissions", {
              assignmentId,
              text: String(form.get("text") ?? "") || undefined,
              fileUrl: String(form.get("fileUrl") ?? "") || undefined,
            });
            setMessage("Submitted.");
            setOpen(false);
            await refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not submit");
          }
        });
      }}
    >
      <textarea
        name="text"
        className="textarea"
        placeholder="Write your answer"
        aria-label="Your answer"
      />
      <input
        name="fileUrl"
        className="input"
        placeholder="Link to a file (optional)"
        aria-label="File URL"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover h-9" disabled={pending}>
          {pending ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          className="text-primary hover:bg-tint hover:text-tint-foreground h-9"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </button>
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Generates a link code for a guardian. No email is sent: the student shares
 * the code themselves and the parent types it into their own panel.
 */
export function CreateParentLinkForm() {
  const refresh = useStudentRefresh();
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (issued) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Give this code to your parent. They sign in, open &quot;Link a
          child&quot; and type it in.
        </p>
        <p className="rounded-[var(--radius-card)] border border-primary bg-tint px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.3em] text-tint-foreground">
          {issued.code}
        </p>
        <p className="text-xs text-muted-foreground">
          Expires{" "}
          {new Date(issued.expiresAt).toLocaleDateString("en-PK", {
            timeZone: "Asia/Karachi",
          })}
          . It works once.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(issued.code);
                setCopied(true);
              } catch {
                setError("Could not copy. Read the code above.");
              }
            }}
          >
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            type="button"
            className="text-primary hover:bg-tint hover:text-tint-foreground"
            onClick={() => {
              setIssued(null);
              setCopied(false);
              void refresh();
            }}
          >
            Done
          </button>
        </div>
        {error ? <p className="text-sm text-status-red">{error}</p> : null}
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
            const issuedCode = await api.post<{ code: string; expiresAt: string }>(
              "/student/parent-links",
              {
                parentName: form.get("parentName"),
                parentEmail: String(form.get("parentEmail") ?? "") || undefined,
              },
            );
            setIssued(issuedCode);
          } catch (error) {
            setError(error instanceof Error ? error.message : "Could not create a link code");
          }
        });
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
          Only for your records. The code is what links the account.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover" disabled={pending}>
          {pending ? "Creating..." : "Create link code"}
        </button>
        {error ? (
          <span className="text-sm text-status-red">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

/** Cancel an unused code so it can no longer be redeemed. */
export function RevokeParentLinkButton({ inviteId }: { inviteId: string }) {
  const refresh = useStudentRefresh();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="border border-border bg-card text-status-red shadow-sm hover:bg-status-red-soft h-9"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await api.post(`/student/parent-links/${inviteId}/revoke`);
          await refresh();
        });
      }}
    >
      {pending ? "Cancelling..." : "Cancel code"}
    </button>
  );
}
