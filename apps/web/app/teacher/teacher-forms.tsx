"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

type ClassOption = {
  id: string;
  name: string;
  courseId: string;
  courseLabel: string;
};

type StudentOption = {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseLabel: string;
};

/** Enrollment rows from the panel loader, reshaped for the forms below. */
export function toStudentOptions(
  rows: {
    enrollmentId: string;
    studentId: string;
    name: string;
    courseId: string;
    courseLabel: string;
  }[],
): StudentOption[] {
  return rows.map((row) => ({
    id: row.enrollmentId,
    studentId: row.studentId,
    studentName: row.name,
    courseId: row.courseId,
    courseLabel: row.courseLabel,
  }));
}

/** Refreshes every teacher-panel query after a mutation. */
function useTeacherRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["teacher"] });
}

/** Accept into a class of the same course, or as one-on-one, or decline. */
export function DecisionForm({
  enrollmentId,
  classes,
}: {
  enrollmentId: string;
  classes: ClassOption[];
}) {
  const refresh = useTeacherRefresh();
  const [classId, setClassId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function decide(decision: "accept" | "decline") {
    setMessage(null);
    startTransition(async () => {
      try {
        await api.post(`/teacher/enrollments/${enrollmentId}/decision`, {
          decision,
          classId: decision === "accept" && classId ? classId : undefined,
        });
        setMessage(decision === "accept" ? "Accepted." : "Declined.");
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not decide");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor={`class-${enrollmentId}`}>
          Place in
        </label>
        <select
          id={`class-${enrollmentId}`}
          className="input w-64"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          disabled={pending}
        >
          <option value="">One-on-one</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {classes.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No class for this course yet. Accepting makes it one-on-one, or
            create a class first.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => decide("accept")}
      >
        {pending ? "Saving..." : "Accept"}
      </button>
      <button
        type="button"
        className="border border-border bg-card text-status-red shadow-sm hover:bg-status-red-soft"
        disabled={pending}
        onClick={() => decide("decline")}
      >
        Decline
      </button>
      {message ? (
        <span className="text-sm text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}

export function ClassForm({
  courses,
}: {
  courses: { id: string; label: string }[];
}) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (courses.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        The office has not assigned you any course yet.
      </p>
    );
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post("/teacher/classes", {
              courseId: form.get("courseId"),
              name: form.get("name"),
              schedule: form.get("schedule") ?? "",
              startsOn: String(form.get("startsOn") ?? "") || undefined,
              endsOn: String(form.get("endsOn") ?? "") || undefined,
            });
            setMessage("Class created.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not create class",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="className">
          Name
        </label>
        <input
          id="className"
          name="name"
          className="input"
          required
          maxLength={120}
        />
      </div>
      <div>
        <label className="label" htmlFor="courseId">
          Course
        </label>
        <select
          id="courseId"
          name="courseId"
          className="input"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="schedule">
          Schedule
        </label>
        <input
          id="schedule"
          name="schedule"
          className="input"
          placeholder="Tue/Thu 6pm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="startsOn">
            Starts
          </label>
          <input id="startsOn" name="startsOn" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="endsOn">
            Ends
          </label>
          <input id="endsOn" name="endsOn" type="date" className="input" />
        </div>
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending}
      >
        {pending ? "Creating..." : "Create class"}
      </button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}

export function EndClassButton({ classId }: { classId: string }) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="border border-border bg-card text-status-red shadow-sm hover:bg-status-red-soft"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "Close this class? Active students stay enrolled, the class moves to Past.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          await api.post(`/teacher/classes/${classId}/past`);
          await refresh();
        });
      }}
    >
      {pending ? "Closing..." : "Close class"}
    </button>
  );
}

export function AssignmentForm({
  classes,
  students,
}: {
  classes: ClassOption[];
  students: StudentOption[];
}) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");

  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:")
    ? target.slice(9)
    : undefined;
  const courseId = classId
    ? classes.find((item) => item.id === classId)?.courseId
    : students.find((item) => item.id === enrollmentId)?.courseId;

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!courseId) {
          setMessage("Choose a class or student");
          return;
        }
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post("/teacher/assignments", {
              courseId,
              classId,
              enrollmentId,
              title: form.get("title"),
              description: form.get("description") ?? "",
              dueAt: String(form.get("dueAt") ?? "") || undefined,
            });
            setMessage("Assignment published.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not publish",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="assignment-target">
          Publish for
        </label>
        <select
          id="assignment-target"
          className="input"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose a class or student
          </option>
          {classes.map((item) => (
            <option key={item.id} value={`class:${item.id}`}>
              Class: {item.name} ({item.courseLabel})
            </option>
          ))}
          {students.map((item) => (
            <option key={item.id} value={`enroll:${item.id}`}>
              Student: {item.studentName} ({item.courseLabel})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="assignment-title">
          Title
        </label>
        <input
          id="assignment-title"
          name="title"
          className="input"
          required
          maxLength={160}
        />
      </div>
      <div>
        <label className="label" htmlFor="assignment-description">
          Description
        </label>
        <textarea
          id="assignment-description"
          name="description"
          className="textarea"
        />
      </div>
      <div>
        <label className="label" htmlFor="assignment-due">
          Due
        </label>
        <input
          id="assignment-due"
          name="dueAt"
          type="datetime-local"
          className="input"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending}
      >
        {pending ? "Publishing..." : "Publish assignment"}
      </button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}

export function GradeForm({
  submissionId,
  score,
  feedback,
}: {
  submissionId: string;
  score: number | null;
  feedback: string;
}) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post(`/teacher/submissions/${submissionId}/grade`, {
              score: form.get("score"),
              feedback: form.get("feedback") ?? "",
            });
            setMessage("Saved.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not grade",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor={`score-${submissionId}`}>
          Score
        </label>
        <input
          id={`score-${submissionId}`}
          name="score"
          type="number"
          min={0}
          max={100}
          defaultValue={score ?? ""}
          className="input w-24"
          required
        />
      </div>
      <div className="grow">
        <label className="label" htmlFor={`feedback-${submissionId}`}>
          Feedback
        </label>
        <input
          id={`feedback-${submissionId}`}
          name="feedback"
          defaultValue={feedback}
          className="input"
          maxLength={2000}
        />
      </div>
      <button
        type="submit"
        className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        disabled={pending}
      >
        {pending ? "Saving..." : score === null ? "Grade" : "Update"}
      </button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </form>
  );
}

export function AttendanceForm({
  classes,
  students,
}: {
  classes: ClassOption[];
  students: StudentOption[];
}) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [presentIds, setPresentIds] = useState<string[]>([]);

  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:")
    ? target.slice(9)
    : undefined;
  const selectedClass = classes.find((item) => item.id === classId);

  const roster = classId
    ? students.filter((item) => item.courseId === selectedClass?.courseId)
    : enrollmentId
      ? students.filter((item) => item.id === enrollmentId)
      : [];
  const studentIds = roster.map((item) => item.studentId);

  function toggle(studentId: string) {
    setPresentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post("/teacher/attendance", {
              classId,
              enrollmentId,
              date: form.get("date"),
              studentIds,
              presentStudentIds: presentIds,
            });
            setMessage("Attendance saved.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not save attendance",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="attendance-target">
          Class or student
        </label>
        <select
          id="attendance-target"
          className="input"
          value={target}
          onChange={(event) => {
            setTarget(event.target.value);
            setPresentIds([]);
          }}
          required
        >
          <option value="" disabled>
            Choose
          </option>
          {classes.map((item) => (
            <option key={item.id} value={`class:${item.id}`}>
              Class: {item.name}
            </option>
          ))}
          {students.map((item) => (
            <option key={item.id} value={`enroll:${item.id}`}>
              Student: {item.studentName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="attendance-date">
          Date
        </label>
        <input
          id="attendance-date"
          name="date"
          type="date"
          className="input"
          required
        />
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Choose a class or student first.
        </p>
      ) : (
        <fieldset className="rounded-[var(--radius-card)] border border-border p-3">
          <legend className="px-1 text-sm font-medium">Present</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roster.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={presentIds.includes(item.studentId)}
                  onChange={() => toggle(item.studentId)}
                />
                {item.studentName}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || studentIds.length === 0}
      >
        {pending ? "Saving..." : "Save attendance"}
      </button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}

export function ConfirmMeetingForm({
  meetingId,
  confirmedAt,
}: {
  meetingId: string;
  confirmedAt: string | null;
}) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = String(form.get("confirmedAt") ?? "");
        if (!value) {
          setMessage("Pick a date and time");
          return;
        }
        setMessage(null);
        startTransition(async () => {
          try {
            await api.post(`/teacher/meetings/${meetingId}/confirm`, {
              confirmedAt: new Date(value).toISOString(),
            });
            setMessage("Confirmed.");
            await refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not confirm",
            );
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor={`meeting-${meetingId}`}>
          Meet at
        </label>
        <input
          id={`meeting-${meetingId}`}
          name="confirmedAt"
          type="datetime-local"
          className="input w-56"
          defaultValue={confirmedAt ? confirmedAt.slice(0, 16) : ""}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending}
      >
        {pending ? "Saving..." : confirmedAt ? "Reschedule" : "Confirm"}
      </button>
      {message ? (
        <span className="text-sm text-muted-foreground">{message}</span>
      ) : null}
    </form>
  );
}

export function RequestNewSlotButton({ meetingId }: { meetingId: string }) {
  const refresh = useTeacherRefresh();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary h-9"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await api.post(`/teacher/meetings/${meetingId}/request-slot`);
          await refresh();
        });
      }}
    >
      {pending ? "Saving..." : "Ask for a new slot"}
    </button>
  );
}
