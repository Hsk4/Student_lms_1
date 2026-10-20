"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAssignment,
  gradeSubmission,
  saveAttendance,
} from "@/actions/assessment";

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

export function AssignmentForm({
  classes,
  students,
}: {
  classes: ClassOption[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");

  const courseId = target.startsWith("class:")
    ? classes.find((item) => item.id === target.slice(6))?.courseId
    : students.find((item) => item.id === target.slice(9))?.courseId;
  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:")
    ? target.slice(9)
    : undefined;

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!courseId) {
          setMessage("Choose a class or student");
          return;
        }
        setPending(true);
        setMessage(null);
        try {
          const result = await createAssignment({
            courseId,
            classId,
            enrollmentId,
            title: form.get("title"),
            description: form.get("description") ?? "",
            dueAt: form.get("dueAt") || undefined,
          });
          if (result.ok) {
            setMessage("Assignment published.");
            router.refresh();
          } else {
            setMessage(result.message ?? "Could not publish");
          }
        } finally {
          setPending(false);
        }
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
              Class: {item.name} - {item.courseLabel}
            </option>
          ))}
          {students.map((item) => (
            <option key={item.id} value={`enroll:${item.id}`}>
              Student: {item.studentName} - {item.courseLabel}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="assignment-title">
          Title
        </label>
        <input id="assignment-title" name="title" className="input" required />
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
      <button type="submit" className="btn-primary" disabled={pending}>
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await gradeSubmission({
            submissionId,
            score: form.get("score"),
            feedback: form.get("feedback") ?? "",
          });
          if (result.ok) {
            setMessage("Saved.");
            router.refresh();
          } else {
            setMessage(result.message ?? "Could not grade");
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="label">Score</label>
        <input
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
        <label className="label">Feedback</label>
        <input name="feedback" defaultValue={feedback} className="input" />
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Saving..." : "Grade"}
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [present, setPresent] = useState(true);

  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:")
    ? target.slice(9)
    : undefined;
  const studentIds = classId
    ? students
        .filter(
          (item) =>
            item.courseId ===
            classes.find((klass) => klass.id === classId)?.courseId,
        )
        .map((item) => item.studentId)
    : enrollmentId
      ? [students.find((item) => item.id === enrollmentId)?.studentId].filter(
          (value): value is string => Boolean(value),
        )
      : [];
  const selected = students.find((item) => item.id === enrollmentId);

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await saveAttendance({
            classId,
            enrollmentId,
            date: form.get("date"),
            studentIds,
            presentStudentIds: present ? studentIds : [],
          });
          if (result.ok) {
            setMessage("Attendance saved.");
            router.refresh();
          } else {
            setMessage(result.message ?? "Could not save attendance");
          }
        } finally {
          setPending(false);
        }
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
          onChange={(event) => setTarget(event.target.value)}
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={present}
          onChange={(event) => setPresent(event.target.checked)}
        />
        Mark {selected ? 'this student' : `${studentIds.length} student(s)`} present
      </label>
      <button
        type="submit"
        className="btn-primary"
        disabled={pending || !target || studentIds.length === 0}
      >
        {pending ? "Saving..." : "Save attendance"}
      </button>
      <p className="text-xs text-muted-foreground">
        {selected
          ? selected.studentName
          : `${studentIds.length} student(s) in this class`}
      </p>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}
