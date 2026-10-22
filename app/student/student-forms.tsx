"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createParentLink, revokeParentLink } from "@/actions/parent";
import { requestEnrollment } from "@/actions/enrollment";
import { submitAssignment } from "@/actions/assessment";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-primary h-9"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await requestEnrollment({ teacherId, courseId });
            if (result.ok) {
              setMessage("Request sent.");
              router.refresh();
            } else {
              setMessage(
                result.error ?? result.message ?? "Could not send request",
              );
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn-primary h-9"
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
          const result = await submitAssignment({
            assignmentId,
            text: String(form.get("text") ?? "") || undefined,
            fileUrl: String(form.get("fileUrl") ?? "") || undefined,
          });
          if (result.ok) {
            setMessage("Submitted.");
            setOpen(false);
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not submit");
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
        <button type="submit" className="btn-primary h-9" disabled={pending}>
          {pending ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          className="btn-ghost h-9"
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
  const router = useRouter();
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
            className="btn-secondary"
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
            className="btn-ghost"
            onClick={() => {
              setIssued(null);
              setCopied(false);
              router.refresh();
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
          const result = await createParentLink({
            parentName: form.get("parentName"),
            parentEmail: String(form.get("parentEmail") ?? "") || undefined,
          });
          if (result.ok && result.data) {
            setIssued(result.data);
          } else {
            setError(
              result.error ?? result.message ?? "Could not create a link code",
            );
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
        <button type="submit" className="btn-primary" disabled={pending}>
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-danger h-9"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await revokeParentLink(inviteId);
          router.refresh();
        });
      }}
    >
      {pending ? "Cancelling..." : "Cancel code"}
    </button>
  );
}
