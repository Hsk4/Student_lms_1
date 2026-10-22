"use client";

import { useState } from "react";
import Link from "next/link";
import { createCourse, toggleCourse, updateCourse } from "@/actions/catalog";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import type { CourseRow as CourseRowData } from "@/lib/queries/admin";

type Option = { id: string; name: string; active: boolean };

export function CourseForm({
  boards,
  levels,
  subjects,
}: {
  boards: Option[];
  levels: Option[];
  subjects: Option[];
}) {
  const active = (list: Option[]) => list.filter((item) => item.active);

  return (
    <ActionForm
      className="mt-3 space-y-3"
      submitLabel="Create course"
      action={async (form) =>
        createCourse({
          boardId: form.get("boardId"),
          levelId: form.get("levelId"),
          subjectId: form.get("subjectId"),
          medium: form.get("medium") ?? "",
          active: true,
        })
      }
    >
      <div>
        <label className="label" htmlFor="course-board">
          Board
        </label>
        <select id="course-board" name="boardId" className="input" required>
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
        <select id="course-level" name="levelId" className="input" required>
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
        <select id="course-subject" name="subjectId" className="input" required>
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
          placeholder="English"
        />
      </div>
    </ActionForm>
  );
}

export function CourseRow({ course }: { course: CourseRowData }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <ActionForm
            className="flex flex-wrap items-end gap-2 py-2"
            submitLabel="Save"
            resetOnSuccess={false}
            action={async (form) => {
              const state = await updateCourse({
                id: course.id,
                boardId: course.boardId,
                levelId: course.levelId,
                subjectId: course.subjectId,
                medium: form.get("medium") ?? "",
                active: form.get("active") === "on",
              });
              if (state?.ok) setEditing(false);
              return state;
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
      <td>
        <Link
          href={`/admin/courses/${course.id}`}
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
          className="btn-ghost h-8"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <ActionButton
          tone="ghost"
          action={() => toggleCourse(course.id, !course.active)}
        >
          {course.active ? "Hide" : "Show"}
        </ActionButton>
      </td>
    </tr>
  );
}
