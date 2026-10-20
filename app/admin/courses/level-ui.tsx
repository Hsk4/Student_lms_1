"use client";

import { useState } from "react";
import { createLevel, toggleLevel, updateLevel } from "@/actions/catalog";
import { ActionButton, ActionForm } from "@/components/ui/action-form";

type Level = { id: string; name: string; order: number; active: boolean };

export function LevelForm() {
  return (
    <ActionForm
      className="mt-3 space-y-3"
      submitLabel="Create level"
      action={async (form) =>
        createLevel({
          name: form.get("name"),
          order: form.get("order"),
          active: true,
        })
      }
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
          min={0}
          max={999}
          className="input"
          placeholder="3"
          required
        />
      </div>
    </ActionForm>
  );
}

export function LevelRow({ level }: { level: Level }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={4}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              const state = await updateLevel({
                id: level.id,
                name: form.get("name"),
                order: form.get("order"),
                active: form.get("active") === "on",
              });
              if (state?.ok) setEditing(false);
              return state;
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
              className="btn-secondary"
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
          className="btn-ghost h-8"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <ActionButton
          tone="ghost"
          action={() => toggleLevel(level.id, !level.active)}
        >
          {level.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
