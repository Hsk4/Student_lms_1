"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";

type Option = { id: string; name: string; active: boolean };

export type CourseRowData = {
  id: string;
  boardId: string;
  board: string;
  levelId: string;
  level: string;
  subjectId: string;
  subject: string;
  medium: string;
  active: boolean;
  books: number;
};

/** The page passes its own `reload`; a form on its own has nothing to refresh. */
const noop = () => {};

export function CourseForm({
  boards,
  levels,
  subjects,
  onDone,
}: {
  boards: Option[];
  levels: Option[];
  subjects: Option[];
  onDone?: () => void;
}) {
  const refresh = onDone ?? noop;
  const active = (list: Option[]) => list.filter((item) => item.active);

  return (
    <ActionForm
      className="mt-4 space-y-4"
      submitLabel="Create course"
      action={async (form) => {
        await api.post("/admin/courses", {
          boardId: form.get("boardId"),
          levelId: form.get("levelId"),
          subjectId: form.get("subjectId"),
          medium: form.get("medium") ?? "",
          active: true,
        });
        await refresh();
        return null;
      }}
    >
      <div>
        <label className="label" htmlFor="course-board">
          Board
        </label>
        <select id="course-board" name="boardId" className="input" defaultValue="" required>
          <option value="" disabled>Choose an exam board</option>
          {active(boards).map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="course-level">
          Level
        </label>
        <select id="course-level" name="levelId" className="input" defaultValue="" required>
          <option value="" disabled>Choose a level</option>
          {active(levels).map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="course-subject">
          Subject
        </label>
        <select id="course-subject" name="subjectId" className="input" defaultValue="" required>
          <option value="" disabled>Choose a subject</option>
          {active(subjects).map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="course-medium">
          Medium (optional)
        </label>
        <input
          id="course-medium"
          name="medium"
          className="input"
          placeholder="e.g. English or Urdu"
          maxLength={60}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Leave blank if the course is not tied to a specific teaching medium.
        </p>
      </div>
    </ActionForm>
  );
}

export function CourseRow({
  course,
  onDone,
}: {
  course: CourseRowData;
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const refresh = onDone ?? noop;

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              await api.patch(`/admin/courses/${course.id}`, {
                boardId: course.boardId,
                levelId: course.levelId,
                subjectId: course.subjectId,
                medium: form.get("medium") ?? "",
                active: form.get("active") === "on",
              });
              setEditing(false);
              await refresh();
              return null;
            }}
          >
            <p className="w-full text-sm text-muted-foreground">
              {course.board} - {course.level} - {course.subject}
            </p>
            <div>
              <label className="label">Medium</label>
              <input
                name="medium"
                defaultValue={course.medium}
                className="input w-48"
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={course.active}
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
      <td>
        <Link
          href={`/admin/courses/detail?id=${course.id}`}
          className="font-medium text-primary"
        >
          {course.subject}
          {course.medium ? ` (${course.medium})` : ""}
        </Link>
        <p className="text-xs text-muted-foreground">{course.level}</p>
      </td>
      <td className="text-sm">{course.board}</td>
      <td>{course.books}</td>
      <td>
        <span
          className={
            course.active ? "text-status-green" : "text-muted-foreground"
          }
        >
          {course.active ? "active" : "hidden"}
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
            await api.patch(`/admin/courses/${course.id}/active`, {
              active: !course.active,
            });
            await refresh();
            return null;
          }}
        >
          {course.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
