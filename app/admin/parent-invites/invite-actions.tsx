"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reissueParentInvite,
  revokeParentInvite,
} from "@/actions/parent-invites";

/**
 * Admin controls for one link code: cancel it, or issue a fresh code when the
 * student lost it. No email is involved in either.
 */
export function InviteActions({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleRevoke = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await revokeParentInvite(inviteId);
      if (result.ok) {
        setMessage({ type: "success", text: "Code cancelled." });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: result.error ?? result.message ?? "Failed to cancel",
        });
      }
    });
  };

  const handleReissue = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await reissueParentInvite(inviteId);
      if (result.ok && result.data) {
        setMessage({ type: "success", text: `New code: ${result.data.code}` });
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: result.error ?? result.message ?? "Failed to reissue",
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
          className="btn-ghost h-8 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleReissue}
          disabled={pending}
          className="btn-secondary h-8 text-xs"
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
