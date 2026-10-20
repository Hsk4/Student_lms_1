export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { getCurrentUser } from "@/lib/auth/roles";
import { listEnrollments } from "@/lib/queries/enrollment";
import { listTeacherClasses } from "@/lib/queries/teaching";
import {
  listTeacherAssignments,
  listAttendance,
} from "@/lib/queries/assessment";
import { AssignmentForm, GradeForm, AttendanceForm } from "./teacher-forms";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "teacher" || user.status !== "active") redirect("/pending");

  const [active, classes, assignments, attendance] = await Promise.all([
    listEnrollments({ teacherId: user.id, state: "active" }),
    listTeacherClasses(user.id),
    listTeacherAssignments(user.id),
    listAttendance(user.id),
  ]);

  return (
    <PanelShell
      title="Teacher assignments"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader
        title="Assignments and attendance"
        description="Publish work, grade submissions and record attendance."
      >
        <a href="/teacher" className="btn-secondary">
          Back to teaching
        </a>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Publish an assignment</h2>
            {classes.length === 0 && active.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Create a class or accept a student first.
              </p>
            ) : (
              <AssignmentForm classes={classes} students={active} />
            )}
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Assignments ({assignments.length})
            </h2>
            {assignments.length === 0 ? (
              <Empty>No assignments yet.</Empty>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="p-4">
                    <p className="font-medium">{assignment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.classId ? "Class assignment" : "One student"}{" "}
                      / {assignment.submissions.length} submission(s)
                    </p>
                    <ul className="mt-3 space-y-3">
                      {assignment.submissions.map((submission) => (
                        <li
                          key={submission.id}
                          className="rounded-[var(--radius-card)] border border-border p-3"
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {submission.text || "No text (file only)"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {submission.score === null
                              ? "Ungraded"
                              : `Scored ${submission.score}/100. ${submission.feedback}`}
                          </p>
                          <div className="mt-2">
                            <GradeForm
                              submissionId={submission.id}
                              score={submission.score}
                              feedback={submission.feedback}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Record attendance</h2>
            {classes.length === 0 && active.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing to record yet.
              </p>
            ) : (
              <AttendanceForm classes={classes} students={active} />
            )}
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Recent attendance</h2>
            {attendance.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No attendance recorded.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {attendance.map((entry) => (
                  <li key={entry.id}>
                    {new Date(entry.date).toLocaleDateString("en-PK", {
                      timeZone: "Asia/Karachi",
                    })}{" "}
                    - {entry.present}/{entry.total} present
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PanelShell>
  );
}

export default function TeacherAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Body />
    </Suspense>
  );
}
