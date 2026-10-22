"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClass, decideEnrollment, markClassPast } from "@/actions/enrollment";
import { confirmMeeting, requestNewSlot } from "@/actions/teacher-meetings";
import { createAssignment, gradeSubmission, saveAttendance } from "@/actions/assessment";

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

/** Accept into a class of the same course, or as one-on-one, or decline. */
export function DecisionForm({
  enrollmentId,
  classes,
}: {
  enrollmentId: string;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function decide(decision: "accept" | "decline") {
    setMessage(null);
    startTransition(async () => {
      const result = await decideEnrollment({
        enrollmentId,
        decision,
        classId: decision === "accept" && classId ? classId : undefined,
      });
      if (result.ok) {
        setMessage(decision === "accept" ? "Accepted." : "Declined.");
        router.refresh();
      } else {
        setMessage(result.error ?? result.message ?? "Could not decide");
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
            No class for this course yet. Accepting makes it one-on-one, or create a class first.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => decide("accept")}
      >
        {pending ? "Saving..." : "Accept"}
      </button>
      <button
        type="button"
        className="btn-danger"
        disabled={pending}
        onClick={() => decide("decline")}
      >
        Decline
      </button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </div>
  );
}

export function ClassForm({ courses }: { courses: { id: string; label: string }[] }) {
  const router = useRouter();
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
          const result = await createClass({
            courseId: form.get("courseId"),
            name: form.get("name"),
            schedule: form.get("schedule") ?? "",
            startsOn: String(form.get("startsOn") ?? "") || undefined,
            endsOn: String(form.get("endsOn") ?? "") || undefined,
          });
          if (result.ok) {
            setMessage("Class created.");
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not create class");
          }
        });
      }}
    >
      <div>
        <label className="label" htmlFor="className">
          Name
        </label>
        <input id="className" name="name" className="input" required maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="courseId">
          Course
        </label>
        <select id="courseId" name="courseId" className="input" required defaultValue="">
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
        <input id="schedule" name="schedule" className="input" placeholder="Tue/Thu 6pm" />
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
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating..." : "Create class"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function EndClassButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-danger"
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
          await markClassPast({ id: classId });
          router.refresh();
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");

  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:") ? target.slice(9) : undefined;
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
          const result = await createAssignment({
            courseId,
            classId,
            enrollmentId,
            title: form.get("title"),
            description: form.get("description") ?? "",
            dueAt: String(form.get("dueAt") ?? "") || undefined,
          });
          if (result.ok) {
            setMessage("Assignment published.");
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not publish");
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
        <input id="assignment-title" name="title" className="input" required maxLength={160} />
      </div>
      <div>
        <label className="label" htmlFor="assignment-description">
          Description
        </label>
        <textarea id="assignment-description" name="description" className="textarea" />
      </div>
      <div>
        <label className="label" htmlFor="assignment-due">
          Due
        </label>
        <input id="assignment-due" name="dueAt" type="datetime-local" className="input" />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Publishing..." : "Publish assignment"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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
          const result = await gradeSubmission({
            submissionId,
            score: form.get("score"),
            feedback: form.get("feedback") ?? "",
          });
          if (result.ok) {
            setMessage("Saved.");
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not grade");
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
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Saving..." : score === null ? "Grade" : "Update"}
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
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
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [presentIds, setPresentIds] = useState<string[]>([]);

  const classId = target.startsWith("class:") ? target.slice(6) : undefined;
  const enrollmentId = target.startsWith("enroll:") ? target.slice(9) : undefined;
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
          const result = await saveAttendance({
            classId,
            enrollmentId,
            date: form.get("date"),
            studentIds,
            presentStudentIds: presentIds,
          });
          if (result.ok) {
            setMessage("Attendance saved.");
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not save attendance");
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
        <input id="attendance-date" name="date" type="date" className="input" required />
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">Choose a class or student first.</p>
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
        className="btn-primary"
        disabled={pending || studentIds.length === 0}
      >
        {pending ? "Saving..." : "Save attendance"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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
  const router = useRouter();
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
          const result = await confirmMeeting({
            meetingId,
            confirmedAt: new Date(value).toISOString(),
          });
          if (result.ok) {
            setMessage("Confirmed.");
            router.refresh();
          } else {
            setMessage(result.error ?? result.message ?? "Could not confirm");
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
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving..." : confirmedAt ? "Reschedule" : "Confirm"}
      </button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </form>
  );
}

export function RequestNewSlotButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-secondary h-9"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await requestNewSlot({ meetingId });
          router.refresh();
        });
      }}
    >
      {pending ? "Saving..." : "Ask for a new slot"}
    </button>
  );
}
