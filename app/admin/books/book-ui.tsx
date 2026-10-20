"use client";

import { useState } from "react";
import { createBook, updateBook } from "@/actions/catalog";
import { ActionForm } from "@/components/ui/action-form";

export type CourseOption = { id: string; label: string };

function CoursePicker({
  courses,
  selected,
  idPrefix,
}: {
  courses: CourseOption[];
  selected: string[];
  idPrefix: string;
}) {
  const [checked, setChecked] = useState<string[]>(selected);

  return (
    <div>
      <p className="label">Courses</p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-[var(--radius-card)] border border-border p-2">
        {courses.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            No courses yet. Create one under Courses.
          </p>
        ) : (
          courses.map((course) => (
            <label key={course.id} className="flex items-center gap-2 text-sm">
              <input
                id={`${idPrefix}-${course.id}`}
                type="checkbox"
                name="courseIds"
                value={course.id}
                checked={checked.includes(course.id)}
                onChange={(event) =>
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, course.id]
                      : current.filter((value) => value !== course.id)
                  )
                }
              />
              <span>{course.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function BookForm({
  courses,
  preselect,
}: {
  courses: CourseOption[];
  preselect?: string;
}) {
  return (
    <ActionForm
      className="mt-3 space-y-3"
      submitLabel="Create book"
      action={async (form) =>
        createBook({
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        })
      }
    >
      <div>
        <label className="label" htmlFor="book-title">
          Title
        </label>
        <input id="book-title" name="title" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="book-author">
          Author (optional)
        </label>
        <input id="book-author" name="author" className="input" />
      </div>
      <CoursePicker
        courses={courses}
        selected={preselect ? [preselect] : []}
        idPrefix="new"
      />
      <div>
        <label className="label" htmlFor="book-note">
          Note (optional)
        </label>
        <textarea id="book-note" name="note" className="textarea" />
      </div>
    </ActionForm>
  );
}

export function EditBookForm({
  book,
  courses,
}: {
  book: { id: string; title: string; author: string; note: string; courseIds: string[] };
  courses: CourseOption[];
}) {
  return (
    <ActionForm
      className="space-y-3"
      submitLabel="Save book"
      resetOnSuccess={false}
      action={async (form) =>
        updateBook({
          id: book.id,
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        })
      }
    >
      <div>
        <label className="label" htmlFor="edit-title">
          Title
        </label>
        <input id="edit-title" name="title" defaultValue={book.title} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="edit-author">
          Author
        </label>
        <input id="edit-author" name="author" defaultValue={book.author} className="input" />
      </div>
      <CoursePicker courses={courses} selected={book.courseIds} idPrefix="edit" />
      <div>
        <label className="label" htmlFor="edit-note">
          Note
        </label>
        <textarea id="edit-note" name="note" defaultValue={book.note} className="textarea" />
      </div>
    </ActionForm>
  );
}
