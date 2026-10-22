"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addTicketMessage,
  createSupportTicket,
  escalateTicket,
} from "@/actions/tuition-support";

/** Opens a support ticket for the signed-in student. */
export function NewTicketForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        setError(null);
        startTransition(async () => {
          try {
            await createSupportTicket({
              subject: String(form.get("subject") ?? "").trim(),
              text: String(form.get("text") ?? "").trim(),
            });
            setMessage("Ticket opened. The office will reply here.");
            router.refresh();
          } catch (submissionError) {
            setError(
              submissionError instanceof Error
                ? submissionError.message
                : "Could not open a ticket",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="ticket-subject">
          Subject
        </label>
        <input
          id="ticket-subject"
          name="subject"
          className="input"
          required
          maxLength={160}
        />
      </div>
      <div>
        <label className="label" htmlFor="ticket-text">
          What do you need help with?
        </label>
        <textarea
          id="ticket-text"
          name="text"
          className="textarea"
          required
          maxLength={4000}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending..." : "Open ticket"}
      </button>
      {message ? <p className="text-sm text-status-green">{message}</p> : null}
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
    </form>
  );
}

/** Adds a follow-up message to one of the caller's tickets. */
export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  return (
    <form
      className="mt-3 flex flex-wrap items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        startTransition(async () => {
          await addTicketMessage({ ticketId, text: value.trim() });
          setValue("");
          router.refresh();
        });
      }}
    >
      <input
        className="input grow"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add a reply"
        aria-label="Reply"
      />
      <button
        type="submit"
        className="btn-secondary"
        disabled={pending || !value.trim()}
      >
        {pending ? "Sending..." : "Reply"}
      </button>
    </form>
  );
}

/** Admin passes a ticket to the super admin. */
export function EscalateTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-secondary h-8"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await escalateTicket({ ticketId });
          router.refresh();
        });
      }}
    >
      {pending ? "Saving..." : "Escalate"}
    </button>
  );
}
