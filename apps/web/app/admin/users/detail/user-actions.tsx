"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/action-form";
import { Card } from "@/components/ui/nila";
import { api } from "@/lib/api-client";

const ROLES = ["student", "teacher", "parent", "admin"] as const;

export function UserActions({
  userId,
  status,
  role,
  onDone,
}: {
  userId: string;
  status: string;
  role: string | null;
  /** The detail page reloads itself after a change. */
  onDone?: () => void;
}) {
  const [nextRole, setNextRole] = useState<string>(role ?? "student");
  const [reason, setReason] = useState("");

  const done = async () => {
    onDone?.();
    return null;
  };

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Assign a role</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assigning a role also activates the account and closes any open
          request.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              className="input w-44"
              value={nextRole}
              onChange={(event) => setNextRole(event.target.value)}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            action={async () => {
              await api.post(`/admin/users/${userId}/role`, { role: nextRole });
              return done();
            }}
          >
            Set role and activate
          </ActionButton>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-foreground">
          Account status
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {status === "suspended" ? (
            <ActionButton
              action={async () => {
                await api.post(`/admin/users/${userId}/reinstate`);
                return done();
              }}
            >
              Reinstate
            </ActionButton>
          ) : (
            <ActionButton
              action={async () => {
                await api.post(`/admin/users/${userId}/suspend`);
                return done();
              }}
              confirm="Suspend this account? They will lose access immediately."
              tone="danger"
            >
              Suspend
            </ActionButton>
          )}

          <div className="grow">
            <label className="label" htmlFor="reason">
              Reject reason
            </label>
            <input
              id="reason"
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required to reject"
            />
          </div>
          <ActionButton
            action={async () => {
              await api.post(`/admin/users/${userId}/reject`, { reason });
              return done();
            }}
            confirm="Reject this account? They cannot re-apply for 30 days."
            tone="danger"
          >
            Reject
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}
