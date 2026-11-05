"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogOption } from "@lms/shared";
import { Card } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/**
 * What the applicant is asking to be. The API treats this as advisory — an
 * admin still picks the role they approve — but it is what tells the office
 * whether this is a student or a teacher, and it pre-selects the approval
 * dropdown so the common case is one click.
 */
const REQUESTED_ROLES = [
  {
    value: "student",
    label: "Student",
    hint: "I am enrolled, or about to enrol, in a class.",
  },
  {
    value: "teacher",
    label: "Teacher",
    hint: "I teach one or more subjects at this school.",
  },
] as const;

type RequestedRole = (typeof REQUESTED_ROLES)[number]["value"];

export function RequestForm({
  defaults,
  boards,
  levels,
  subjects,
}: {
  defaults: { name: string; email: string };
  boards: CatalogOption[];
  levels: CatalogOption[];
  subjects: CatalogOption[];
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("student");
  const isTeacher = requestedRole === "teacher";

  function toggleSubject(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <Card className="p-6">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setMessage(null);
          try {
            await api.post("/me/request", {
              name: form.get("name"),
              email: form.get("email"),
              boardId: form.get("boardId") ?? "",
              levelId: form.get("levelId") ?? "",
              subjectIds: selected,
              note: form.get("note") ?? "",
              // Advisory: the admin still chooses the role they approve.
              requestedRole,
            });
            // The request changed the account; /pending reads the new state.
            await refresh();
            router.push("/pending");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not submit",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {/*
         * The role comes first: it decides what the rest of the form means. A
         * teacher picks the subjects they teach; a student picks the subjects
         * they are enrolled in. Without this the office had to guess from the
         * note, and every request arrived looking like a student.
         */}
        <fieldset>
          <legend className="label">I am asking to join as</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REQUESTED_ROLES.map((option) => {
              const active = requestedRole === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 transition-colors duration-150 ${
                    active
                      ? "border-primary bg-tint"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestedRole"
                    value={option.value}
                    checked={active}
                    onChange={() => setRequestedRole(option.value)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={defaults.name}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults.email}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="boardId">
              Board
            </label>
            <select
              id="boardId"
              name="boardId"
              className="input"
              defaultValue=""
            >
              <option value="">Not sure yet</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="levelId">
              Level
            </label>
            <select
              id="levelId"
              name="levelId"
              className="input"
              defaultValue=""
            >
              <option value="">Not sure yet</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">
            {isTeacher ? "Subjects you teach" : "Subjects you are enrolled in"}
          </legend>
          {isTeacher ? (
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              Pick every subject you can teach. The office uses this to match
              you to courses; an admin confirms the exact classes when they
              approve you.
            </p>
          ) : null}
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The catalog is empty. An admin can add subjects under Courses.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const active = selected.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className={`chip h-8 px-3 transition-colors duration-150 ${
                      active
                        ? "border-primary bg-tint text-tint-foreground"
                        : "border-border text-muted-foreground hover:text-primary"
                    }`}
                    aria-pressed={active}
                  >
                    {subject.label}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <div>
          <label className="label" htmlFor="note">
            Anything we should know? (optional)
          </label>
          <textarea id="note" name="note" className="textarea" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Submitting..." : "Submit request"}
          </button>
          {message ? (
            <span className="text-sm text-status-red">{message}</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
