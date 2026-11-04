"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";
import { useAction } from "@/lib/use-async";

const ROLES = ["student", "teacher", "parent", "admin"] as const;

export function RequestActions({
  requestId,
  defaultRole = "student",
  onDecided,
}: {
  requestId: string;
  defaultRole?: string;
  /** The list reloads itself; this is the screen saying "my data changed". */
  onDecided: () => void;
}) {
  const [role, setRole] = useState<string>(defaultRole);
  const [reason, setReason] = useState("");

  const decide = useAction(onDecided);

  const submit = (
    decision: "approve" | "reject",
    body: { role?: string; reason?: string },
  ) =>
    decide.run(() =>
      api.post<null>(`/admin/requests/${requestId}/decision`, {
        decision,
        ...body,
      }),
    );

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <div>
        <label className="label" htmlFor={`role-${requestId}`}>
          Approve as
        </label>
        <select
          id={`role-${requestId}`}
          className="input w-40"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <ActionButton
        action={() => submit("approve", { role })}
        tone="secondary"
      >
        Approve
      </ActionButton>
      <div className="grow">
        <label className="label" htmlFor={`reason-${requestId}`}>
          Reject reason
        </label>
        <input
          id={`reason-${requestId}`}
          className="input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required to reject"
        />
      </div>

      <ActionButton
        action={() => submit("reject", { reason })}
        confirm="Reject this request? The user cannot re-apply for 30 days."
        tone="danger"
      >
        Reject
      </ActionButton>
    </div>
  );
}

/** Kept for the sync button elsewhere: one place that talks to the API. */
export const syncAdmin = () =>
  api.post<{ deleted: number; synced: number }>("/admin/users/sync");
