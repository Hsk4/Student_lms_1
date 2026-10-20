"use client";

import { useState } from "react";
import { createSubject, toggleSubject, updateSubject } from "@/actions/catalog";
import { ActionButton, ActionForm } from "@/components/ui/action-form";

type Subject = { id: string; name: string; slug: string; active: boolean };

export function SubjectForm() {
  return (
    <ActionForm
      className="mt-3 space-y-3"
      submitLabel="Create subject"
      action={async (form) =>
        createSubject({
          name: form.get("name"),
          slug: form.get("slug"),
          active: true,
        })
      }
    >
      <div>
        <label className="label" htmlFor="subject-name">
          Name
        </label>
        <input
          id="subject-name"
          name="name"
          className="input"
          placeholder="Mathematics"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="subject-slug">
          Slug
        </label>
        <input
          id="subject-slug"
          name="slug"
          className="input"
          placeholder="mathematics"
          required
        />
      </div>
    </ActionForm>
  );
}

export function SubjectRow({ subject }: { subject: Subject }) {
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
              const state = await updateSubject({
                id: subject.id,
                name: form.get("name"),
                slug: form.get("slug"),
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
                defaultValue={subject.name}
                className="input w-56"
                required
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input
                name="slug"
                defaultValue={subject.slug}
                className="input w-48"
                required
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={subject.active}
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
      <td className="font-medium">{subject.name}</td>
      <td className="font-mono text-xs text-muted-foreground">
        {subject.slug}
      </td>
      <td>
        <span
          className={
            subject.active ? "text-status-green" : "text-muted-foreground"
          }
        >
          {subject.active ? "active" : "hidden"}
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
          action={() => toggleSubject(subject.id, !subject.active)}
        >
          {subject.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
