"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";

type Board = { id: string; name: string; slug: string; active: boolean };

/** Every board mutation refreshes the board list and the course table. */
function useBoardRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-boards"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] }),
      queryClient.invalidateQueries({ queryKey: ["form-options"] }),
    ]);
}

export function BoardForm() {
  const refresh = useBoardRefresh();
  return (
    <ActionForm
      className="mt-3 space-y-3"
      submitLabel="Create board"
      action={async (form) => {
        await api.post("/admin/boards", {
          name: form.get("name"),
          slug: form.get("slug"),
          active: true,
        });
        await refresh();
        return null;
      }}
    >
      <div>
        <label className="label" htmlFor="board-name">
          Name
        </label>
        <input
          id="board-name"
          name="name"
          className="input"
          placeholder="Sindh Board"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="board-slug">
          Slug
        </label>
        <input
          id="board-slug"
          name="slug"
          className="input"
          placeholder="sindh-board"
          required
        />
      </div>
    </ActionForm>
  );
}

export function BoardRow({
  board,
  courseCount,
}: {
  board: Board;
  courseCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const refresh = useBoardRefresh();

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              await api.patch(`/admin/boards/${board.id}`, {
                name: form.get("name"),
                slug: form.get("slug"),
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
                defaultValue={board.name}
                className="input w-56"
                required
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input
                name="slug"
                defaultValue={board.slug}
                className="input w-48"
                required
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={board.active}
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
      <td className="font-medium">{board.name}</td>
      <td className="font-mono text-xs text-muted-foreground">{board.slug}</td>
      <td>{courseCount}</td>
      <td>
        <span
          className={
            board.active ? "text-status-green" : "text-muted-foreground"
          }
        >
          {board.active ? "active" : "hidden"}
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
            await api.patch(`/admin/boards/${board.id}/active`, {
              active: !board.active,
            });
            await refresh();
            return null;
          }}
        >
          {board.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
