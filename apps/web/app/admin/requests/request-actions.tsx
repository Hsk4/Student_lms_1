"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/action-form";
import { api } from "@/lib/api-client";
import { useAction, useAsync } from "@/lib/use-async";

const ROLES = ["student", "teacher", "parent", "admin"] as const;

type CourseOption = { id: string; label: string; subjectId?: string };

export function RequestActions({
  requestId,
  defaultRole = "student",
  /** Subjects the applicant said they teach, used to pre-tick courses. */
  requestedSubjectIds = [],
  onDecided,
}: {
  requestId: string;
  defaultRole?: string;
  requestedSubjectIds?: string[];
  /** The list reloads itself; this is the screen saying "my data changed". */
  onDecided: () => void;
}) {
  const [role, setRole] = useState<string>(defaultRole);
  const [reason, setReason] = useState("");
  const [courseIds, setCourseIds] = useState<string[] | null>(null);

  const decide = useAction(onDecided);

  /*
   * Courses are only fetched once the admin is actually approving a teacher:
   * the list is long, and most requests are students. `enabled` keeps the
   * request from firing for every row on the page.
   */
  const isTeacher = role === "teacher";
  const coursesQuery = useAsync(
    () => api.get<CourseOption[]>("/admin/catalog/teacher-courses"),
    [],
    { enabled: isTeacher },
  );
  const courses = coursesQuery.data ?? [];

  /*
   * Pre-tick the courses whose subject the applicant named, so the admin starts
   * from "the subjects they said they teach" and only has to narrow it to the
   * right board and level. They can always change it before approving.
   */
  const suggested = new Set(
    courses
      .filter(
        (course) =>
          course.subjectId !== undefined &&
          requestedSubjectIds.includes(course.subjectId),
      )
      .map((course) => course.id),
  );
  const selected = courseIds ?? [...suggested];

  const toggleCourse = (id: string) =>
    setCourseIds((current) => {
      const base = current ?? [...suggested];
      return base.includes(id)
        ? base.filter((value) => value !== id)
        : [...base, id];
    });

  const submit = (
    decision: "approve" | "reject",
    body: { role?: string; reason?: string; courseIds?: string[] },
  ) =>
    decide.run(() =>
      api.post<null>(`/admin/requests/${requestId}/decision`, {
        decision,
        ...body,
      }),
    );

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <div>
        <label className="label" htmlFor={`role-${requestId}`}>
          Approve as
        </label>
        <select
          id={`role-${requestId}`}
          className="input w-40"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <ActionButton
        action={() =>
          submit("approve", {
            role,
            // Only a teacher holds courses; sending them for any other role
            // would be ignored by the API but is misleading in the audit log.
            ...(isTeacher ? { courseIds: selected } : {}),
          })
        }
        tone="secondary"
      >
        Approve
      </ActionButton>
      <div className="grow">
        <label className="label" htmlFor={`reason-${requestId}`}>
          Reject reason
        </label>
        <input
          id={`reason-${requestId}`}
          className="input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required to reject"
        />
      </div>

      <ActionButton
        action={() => submit("reject", { reason })}
        confirm="Reject this request? The user cannot re-apply for 30 days."
        tone="danger"
      >
        Reject
      </ActionButton>

      {/*
       * Approving a teacher is two decisions in one: the role, and which
       * classes they teach. Asking for both here means the office does not
       * have to approve, then find the user again to assign courses.
       */}
      {isTeacher ? (
        <div className="w-full border-t border-border pt-3">
          <p className="label">
            Courses to assign ({selected.length} selected)
          </p>
          {coursesQuery.loading ? (
            <p className="text-sm text-muted-foreground">Loading courses…</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active courses yet. Approve now and assign courses later from
              the user&apos;s page.
            </p>
          ) : (
            <div className="mt-1 grid max-h-56 gap-1 overflow-y-auto rounded-[var(--radius-card)] border border-border p-2 sm:grid-cols-2">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                  />
                  <span className="min-w-0">{course.label}</span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Courses can also be changed later from the user&apos;s
            page.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Kept for the sync button elsewhere: one place that talks to the API. */
export const syncAdmin = () =>
  api.post<{ deleted: number; synced: number }>("/admin/users/sync");
