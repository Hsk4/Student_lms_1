export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  Stat,
  formatDate,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
import {
  getMyProfile,
  listMyAssignments,
  listMyAttendance,
  listMyGrades,
} from "@/actions/student-panel";

export default async function StudentDashboardPage() {
  const [profile, assignments, attendance, grades] = await Promise.all([
    getMyProfile(),
    listMyAssignments(),
    listMyAttendance(),
    listMyGrades(),
  ]);

  const open = assignments.filter((item) => !item.submissionId);
  const present = attendance.filter((item) => item.present).length;
  const attendanceRate = attendance.length
    ? Math.round((present / attendance.length) * 100)
    : null;
  const averageScore = grades.length
    ? Math.round(
        grades.reduce((sum, item) => sum + item.score, 0) / grades.length,
      )
    : null;

  return (
    <div>
      <PageHeader
        title="My learning"
        description="Your teacher, work in progress and latest results."
      >
        <Link href="/student/teachers" className="btn-primary">
          Find a teacher
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active courses" value={profile.activeCourseCount} />
        <Stat
          label="Open work"
          value={open.length}
          hint={
            open.length ? "Assignments not submitted yet" : "Nothing pending"
          }
        />
        <Stat
          label="Average score"
          value={averageScore === null ? "-" : `${averageScore}%`}
          hint={`${grades.length} graded`}
        />
        <Stat
          label="Attendance"
          value={attendanceRate === null ? "-" : `${attendanceRate}%`}
          hint={`${attendance.length} classes recorded`}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My teachers
        </h2>
        {profile.teachers.length === 0 ? (
          <Empty>
            You have no teacher yet.{" "}
            <Link
              href="/student/teachers"
              className="font-medium text-primary hover:underline"
            >
              Pick a teacher
            </Link>{" "}
            to start learning.
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.teachers.map((teacher, index) => (
              <Card key={`${teacher.name}-${index}`} className="p-4">
                <p className="font-medium text-foreground">{teacher.name}</p>
                <p className="text-sm text-muted-foreground">
                  {teacher.courseLabel}
                </p>
                <p className="mt-1 text-sm">
                  {teacher.className ?? "One-on-one"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Assignments
          </h2>
          <Link
            href="/student/assignments"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {assignments.length === 0 ? (
          <Empty>No assignments yet.</Empty>
        ) : (
          <div className="space-y-3">
            {assignments.slice(0, 5).map((assignment) => (
              <Card key={assignment.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {assignment.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {formatDate(assignment.dueAt)}
                    </p>
                  </div>
                  {assignment.submissionId ? (
                    assignment.score === null ? (
                      <Chip tone="amber">Awaiting grade</Chip>
                    ) : (
                      <Score value={assignment.score} />
                    )
                  ) : (
                    <Chip tone="primary">To do</Chip>
                  )}
                </div>
                {assignment.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {assignment.description}
                  </p>
                ) : null}
                {assignment.submissionId ? null : (
                  <Link
                    href="/student/assignments"
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Submit work
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent grades
          </h2>
          {grades.length === 0 ? (
            <Empty>No grades yet.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {grades.slice(0, 5).map((grade) => (
                <div
                  key={grade.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {grade.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {grade.courseLabel} / {formatDay(grade.gradedAt)}
                    </p>
                  </div>
                  <Score value={grade.score} />
                </div>
              ))}
            </Card>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent attendance
          </h2>
          {attendance.length === 0 ? (
            <Empty>No attendance recorded yet.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {attendance.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.context}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(entry.date)}
                    </p>
                  </div>
                  <Chip
                    tone={entry.present ? toneFor("present") : toneFor("past")}
                  >
                    {entry.present ? "Present" : "Absent"}
                  </Chip>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
