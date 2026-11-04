"use client";

import { useState, useTransition } from "react";
import { api } from "@/lib/api-client";

/**
 * Admin controls for one link code: cancel it, or issue a fresh code when the
 * student lost it. No email is involved in either.
 */
export function InviteActions({
  inviteId,
  onDone,
}: {
  inviteId: string;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const refresh = async () => onDone?.();

  const handleRevoke = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        await api.post(`/admin/parent-links/${inviteId}/revoke`);
        setMessage({ type: "success", text: "Code cancelled." });
        await refresh();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to cancel",
        });
      }
    });
  };

  const handleReissue = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await api.post<{ code: string }>(
          `/admin/parent-links/${inviteId}/reissue`,
        );
        setMessage({ type: "success", text: `New code: ${result.code}` });
        await refresh();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to reissue",
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRevoke}
          disabled={pending}
          className="text-primary hover:bg-tint hover:text-tint-foreground h-8 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleReissue}
          disabled={pending}
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary h-8 text-xs"
        >
          New code
        </button>
      </div>
      {message ? (
        <p
          className={`text-xs font-medium ${
            message.type === "success" ? "text-status-green" : "text-status-red"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
