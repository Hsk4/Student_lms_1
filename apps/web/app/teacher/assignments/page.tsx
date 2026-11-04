"use client";

import { useAsync } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  formatDate,
} from "@/components/ui/nila";
import { AssignmentForm, GradeForm, toStudentOptions } from "../teacher-forms";

type SubmissionRow = {
  id: string;
  studentId: string;
  score: number | null;
  feedback: string;
  text: string | null;
};
type AssignmentRow = {
  id: string;
  title: string;
  classId: string | null;
  dueAt: string | null;
  submissions: SubmissionRow[];
};
type StudentRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  courseId: string;
  courseLabel: string;
};
type TeacherClass = { id: string; name: string; courseId: string; courseLabel: string; state: string };

export default function TeacherAssignmentsPage() {
  const assignmentsQuery = useAsync(
    () => api.get<AssignmentRow[]>("/teacher/assignments"),
    [],
  );
  const classesQuery = useAsync(
    () => api.get<TeacherClass[]>("/teacher/classes"),
    [],
  );
  const studentsQuery = useAsync(
    () => api.get<StudentRow[]>("/teacher/students"),
    [],
  );

  const assignments = assignmentsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const ungraded = assignments.reduce(
    (sum, assignment) =>
      sum + assignment.submissions.filter((row) => row.score === null).length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={`Publish work to a class or one student, then grade the submissions. ${ungraded} waiting to grade.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Published ({assignments.length})
          </h2>
          {assignments.length === 0 ? (
            <Empty>No assignment yet.</Empty>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <Card key={assignment.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.classId
                          ? "Class assignment"
                          : "One student"}{" "}
                        / due {formatDate(assignment.dueAt)}
                      </p>
                    </div>
                    <Chip
                      tone={
                        assignment.submissions.some((row) => row.score === null)
                          ? "amber"
                          : "neutral"
                      }
                    >
                      {assignment.submissions.length} submission
                      {assignment.submissions.length === 1 ? "" : "s"}
                    </Chip>
                  </div>

                  {assignment.submissions.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No submission yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {assignment.submissions.map((submission) => {
                        const student = students.find(
                          (row) => row.studentId === submission.studentId,
                        );
                        return (
                          <li
                            key={submission.id}
                            className="rounded-[var(--radius-card)] border border-border p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                {student?.name ?? "Student"}
                              </p>
                              {submission.score === null ? (
                                <Chip tone="amber">Ungraded</Chip>
                              ) : (
                                <Score value={submission.score} />
                              )}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                              {submission.text || "No text (file only)"}
                            </p>
                            <div className="mt-2">
                              <GradeForm
                                submissionId={submission.id}
                                score={submission.score}
                                feedback={submission.feedback}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Publish an assignment</h2>
          {classes.length === 0 && students.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Create a class or accept a student first.
            </p>
          ) : (
            <AssignmentForm classes={classes} students={toStudentOptions(students)} />
          )}
        </Card>
      </div>
    </div>
  );
}
