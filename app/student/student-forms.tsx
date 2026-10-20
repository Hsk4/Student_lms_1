"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestEnrollment } from "@/actions/enrollment";
import { submitAssignment } from "@/actions/assessment";

export function RequestTeacherForm({
  teacherId,
  courseId,
}: {
  teacherId: string;
  courseId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="ms-2 inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-ghost h-8"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          try {
            const result = await requestEnrollment({ teacherId, courseId });
            if (result.ok) {
              setMessage("Request sent.");
              router.refresh();
            } else {
              setMessage(result.message ?? "Could not request");
            }
          } finally {
            setPending(false);
          }
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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await submitAssignment({
            assignmentId,
            text: form.get("text") ?? "",
            fileUrl: form.get("fileUrl") || undefined,
          });
          if (result.ok) {
            setMessage("Submitted.");
            router.refresh();
          } else {
            setMessage(result.message ?? "Could not submit");
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <textarea name="text" className="textarea" placeholder="Your answer" />
      <input
        name="fileUrl"
        className="input"
        placeholder="File URL (optional)"
      />
      <button type="submit" className="btn-primary h-8" disabled={pending}>
        {pending ? "Submitting..." : "Submit"}
      </button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}
