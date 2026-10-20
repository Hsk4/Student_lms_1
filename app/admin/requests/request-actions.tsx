"use client";

import { useState } from "react";
import { decideAccessRequest } from "@/actions/admin";
import { ActionButton } from "@/components/ui/action-form";

const ROLES = ["student", "teacher", "parent", "admin"] as const;

export function RequestActions({ requestId }: { requestId: string }) {
  const [role, setRole] = useState<string>("student");
  const [reason, setReason] = useState("");

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
        action={() => decideAccessRequest(requestId, "approve", role)}
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
        action={() =>
          decideAccessRequest(requestId, "reject", undefined, reason)
        }
        confirm="Reject this request? The user cannot re-apply for 30 days."
        tone="danger"
      >
        Reject
      </ActionButton>
    </div>
  );
}
