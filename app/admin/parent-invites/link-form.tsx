"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkGuardian, unlinkGuardian } from "@/actions/guardians";

type Option = { id: string; label: string };

/** Admin repair: link a parent account to a student, or remove the link. */
export function LinkGuardianForm({
  parents,
  students,
}: {
  parents: Option[];
  students: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: "link" | "unlink", form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      parentId: String(data.get("parentId") ?? ""),
      studentId: String(data.get("studentId") ?? ""),
    };
    if (!payload.parentId || !payload.studentId) {
      setError("Choose both a parent and a student");
      return;
    }
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result =
        action === "link"
          ? await linkGuardian(payload)
          : await unlinkGuardian(payload);
      if (result.ok) {
        setMessage(action === "link" ? "Linked." : "Link removed.");
        router.refresh();
      } else {
        setError(result.error ?? result.message ?? "Could not save the link");
      }
    });
  }

  if (parents.length === 0 || students.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Need at least one active parent and one active student.
      </p>
    );
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        run("link", event.currentTarget);
      }}
    >
      <div>
        <label className="label" htmlFor="link-parent">
          Parent
        </label>
        <select
          id="link-parent"
          name="parentId"
          className="input"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Choose a parent
          </option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="link-student">
          Student
        </label>
        <select
          id="link-student"
          name="studentId"
          className="input"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Choose a student
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Link"}
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={pending}
          onClick={(event) => {
            const form = event.currentTarget.form;
            if (form) run("unlink", form);
          }}
        >
          Remove link
        </button>
      </div>
      {message ? <p className="text-sm text-status-green">{message}</p> : null}
      {error ? <p className="text-sm text-status-red">{error}</p> : null}
    </form>
  );
}
