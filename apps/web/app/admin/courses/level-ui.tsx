"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";

type Level = { id: string; name: string; order: number; active: boolean };

function useLevelRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] }),
      queryClient.invalidateQueries({ queryKey: ["form-options"] }),
    ]);
}

export function LevelForm() {
  const refresh = useLevelRefresh();
  return (
    <ActionForm
      className="mt-4 space-y-4"
      submitLabel="Create level"
      action={async (form) => {
        await api.post("/admin/levels", {
          name: form.get("name"),
          order: form.get("order"),
          active: true,
        });
        await refresh();
        return null;
      }}
    >
      <div>
        <label className="label" htmlFor="level-name">
          Name
        </label>
        <input
          id="level-name"
          name="name"
          className="input"
          placeholder="O Level"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="level-order">
          Order
        </label>
        <input
          id="level-order"
          name="order"
          type="number"
          min={1}
          max={999}
          inputMode="numeric"
          className="input"
          placeholder="3"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Controls the order in which levels appear in student forms.
        </p>
      </div>
    </ActionForm>
  );
}

export function LevelRow({ level }: { level: Level }) {
  const [editing, setEditing] = useState(false);
  const refresh = useLevelRefresh();

  if (editing) {
    return (
      <tr>
        <td colSpan={4}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              await api.patch(`/admin/levels/${level.id}`, {
                name: form.get("name"),
                order: form.get("order"),
                active: form.get("active") === "on",
              });
              setEditing(false);
              await refresh();
              return null;
            }}
          >
            <div>
              <label className="label">Name</label>
              <input
                name="name"
                defaultValue={level.name}
                className="input w-56"
                required
              />
            </div>
            <div>
              <label className="label">Order</label>
              <input
                name="order"
                type="number"
                defaultValue={level.order}
                className="input w-24"
                required
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={level.active}
              />
              Active
            </label>
            <button
              type="button"
              className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </ActionForm>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="w-16 tabular-nums">{level.order}</td>
      <td className="font-medium">{level.name}</td>
      <td>
        <span
          className={
            level.active ? "text-status-green" : "text-muted-foreground"
          }
        >
          {level.active ? "active" : "hidden"}
        </span>
      </td>
      <td className="text-end">
        <button
          type="button"
          className="text-primary hover:bg-tint hover:text-tint-foreground h-8"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <ActionButton
          tone="ghost"
          action={async () => {
            await api.patch(`/admin/levels/${level.id}/active`, {
              active: !level.active,
            });
            await refresh();
            return null;
          }}
        >
          {level.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
