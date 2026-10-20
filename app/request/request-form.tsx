"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitAccessRequest } from "@/actions/onboarding";
import { Card } from "@/components/ui/nila";
import type { CatalogOption } from "@/actions/catalog-reads";

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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

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
            const result = await submitAccessRequest({
              name: form.get("name"),
              email: form.get("email"),
              boardId: form.get("boardId") ?? "",
              levelId: form.get("levelId") ?? "",
              subjectIds: selected,
              note: form.get("note") ?? "",
            });
            if (result.ok) {
              router.push("/pending");
              router.refresh();
            } else {
              setMessage(result.message ?? "Could not submit");
            }
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not submit",
            );
          } finally {
            setPending(false);
          }
        }}
      >
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
          <legend className="label">Subjects</legend>
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
          <button type="submit" className="btn-primary" disabled={pending}>
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
