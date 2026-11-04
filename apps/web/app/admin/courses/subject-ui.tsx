"use client";

import { useState } from "react";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";

type Subject = { id: string; name: string; slug: string; active: boolean };

/** The page passes its own `reload`; a form on its own has nothing to refresh. */
const noop = () => {};

export function SubjectForm({ onDone }: { onDone?: () => void }) {
  const refresh = onDone ?? noop;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }
  return (
    <ActionForm
      className="mt-4 space-y-4"
      submitLabel="Create subject"
      action={async (form) => {
        await api.post("/admin/subjects", {
          name: form.get("name"),
          slug: form.get("slug"),
          active: true,
        });
        await refresh();
        setName("");
        setSlug("");
        setSlugEdited(false);
        return null;
      }}
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
          autoComplete="off"
          value={name}
          onChange={(event) => updateName(event.target.value)}
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
          autoComplete="off"
          spellCheck={false}
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Generated from the subject name. You can edit it before saving.
        </p>
      </div>
    </ActionForm>
  );
}

export function SubjectRow({
  subject,
  onDone,
}: {
  subject: Subject;
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const refresh = onDone ?? noop;

  if (editing) {
    return (
      <tr>
        <td colSpan={4}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              await api.patch(`/admin/subjects/${subject.id}`, {
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
          className="text-primary hover:bg-tint hover:text-tint-foreground h-8"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <ActionButton
          tone="ghost"
          action={async () => {
            await api.patch(`/admin/subjects/${subject.id}/active`, {
              active: !subject.active,
            });
            await refresh();
            return null;
          }}
        >
          {subject.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
