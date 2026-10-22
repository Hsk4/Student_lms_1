"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestMeeting, rescheduleMeeting } from "@/actions/parent-panel";

/** A parent asks the child's teacher for a meeting. */
export function RequestMeetingForm({
  childRows,
  defaultStudentId,
}: {
  childRows: { id: string; name: string }[];
  defaultStudentId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (childRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Link a child before requesting a meeting.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await requestMeeting({
            studentId: form.get("studentId"),
            preferredDay: form.get("preferredDay"),
            note: String(form.get("note") ?? "") || undefined,
          });
          if (result.ok) {
            setMessage("Request sent to the teacher.");
            router.refresh();
          } else {
            setError(
              result.error ?? result.message ?? "Could not send the request",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="meeting-child">
          Child
        </label>
        <select
          id="meeting-child"
          name="studentId"
          className="input"
          required
          defaultValue={defaultStudentId ?? ""}
        >
          <option value="" disabled>
            Choose a child
          </option>
          {childRows.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="meeting-day">
          Preferred day and time
        </label>
        <input
          id="meeting-day"
          name="preferredDay"
          className="input"
          placeholder="Tuesday after 5pm"
          required
          maxLength={60}
        />
      </div>
      <div>
        <label className="label" htmlFor="meeting-note">
          Note for the teacher (optional)
        </label>
        <textarea
          id="meeting-note"
          name="note"
          className="textarea"
          maxLength={500}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending..." : "Request meeting"}
      </button>
      {message ? <p className="text-sm text-status-green">{message}</p> : null}
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
    </form>
  );
}

/** A parent asks for a new time on a meeting already confirmed. */
export function RescheduleMeetingForm({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary h-9"
        onClick={() => setOpen(true)}
      >
        Ask to reschedule
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          await rescheduleMeeting({
            meetingId,
            preferredDay: String(form.get("preferredDay") ?? ""),
          });
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <div>
        <label className="label" htmlFor={`reschedule-${meetingId}`}>
          New preferred day
        </label>
        <input
          id={`reschedule-${meetingId}`}
          name="preferredDay"
          className="input w-56"
          required
          maxLength={60}
        />
      </div>
      <button type="submit" className="btn-primary h-10" disabled={pending}>
        {pending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
