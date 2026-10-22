export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDate,
} from "@/components/ui/nila";
import {
  getTeacherDashboard,
  listClasses,
  listMyAssignments,
  listMyMeetings,
  listStudentRequests,
} from "@/actions/teacher-panel";

export default async function TeacherDashboardPage() {
  const [dashboard, requests, classes, assignments, meetings] =
    await Promise.all([
      getTeacherDashboard(),
      listStudentRequests(),
      listClasses(),
      listMyAssignments(),
      listMyMeetings(),
    ]);

  const current = classes.filter((item) => item.state === "current");
  const upcoming = meetings
    .filter(
      (item) =>
        item.state === "requested" ||
        (item.confirmedAt !== null && new Date(item.confirmedAt) >= new Date()),
    )
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Teaching"
        description="Accept requests, run classes and give feedback."
      >
        <Link href="/teacher/assignments" className="btn-primary">
          New assignment
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Students"
          value={dashboard.students}
          hint={`${dashboard.classes} current classes`}
        />
        <Stat
          label="Requests"
          value={dashboard.pendingRequests}
          hint={
            requests.length ? "Waiting for your decision" : "Nothing waiting"
          }
        />
        <Stat
          label="Ungraded"
          value={dashboard.ungradedSubmissions}
          hint={
            dashboard.ungradedSubmissions
              ? "Submissions to grade"
              : "All graded"
          }
        />
        <Stat
          label="Average score"
          value={
            dashboard.averageScore === null ? "-" : `${dashboard.averageScore}%`
          }
          hint="Across graded submissions"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Student requests
            </h2>
            <Link
              href="/teacher/requests"
              className="text-sm font-medium text-primary hover:underline"
            >
              Review all
            </Link>
          </div>
          {requests.length === 0 ? (
            <Empty>No pending requests.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {requests.slice(0, 4).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {request.studentName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {request.courseLabel}
                    </p>
                  </div>
                  <Chip tone="amber">Requested</Chip>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Meetings
            </h2>
            <Link
              href="/teacher/meetings"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty>No meeting requests.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {upcoming.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {meeting.parentName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      For {meeting.studentName} /{" "}
                      {meeting.confirmedAt
                        ? formatDate(meeting.confirmedAt)
                        : meeting.slots}
                    </p>
                  </div>
                  <Chip
                    tone={meeting.state === "confirmed" ? "green" : "amber"}
                  >
                    {meeting.state}
                  </Chip>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Current classes
          </h2>
          <Link
            href="/teacher/classes"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage classes
          </Link>
        </div>
        {current.length === 0 ? (
          <Empty>
            No class yet. Create one from Classes, then accept students into it.
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((klass) => (
              <Link
                key={klass.id}
                href={`/teacher/classes/${klass.id}`}
                className="block"
              >
                <Card className="p-4 transition-colors duration-150 hover:bg-tint">
                  <p className="font-medium">{klass.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {klass.courseLabel}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {klass.schedule || "Schedule not set"} /{" "}
                    {klass.studentCount} students
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent assignments
          </h2>
          <Link
            href="/teacher/assignments"
            className="text-sm font-medium text-primary hover:underline"
          >
            All assignments
          </Link>
        </div>
        {assignments.length === 0 ? (
          <Empty>Nothing published yet.</Empty>
        ) : (
          <Card className="divide-y divide-border">
            {assignments.slice(0, 5).map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {assignment.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.classId ? "Class" : "One student"} /{" "}
                    {assignment.submissions.length} submission
                    {assignment.submissions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Chip
                  tone={
                    assignment.submissions.some((row) => row.score === null)
                      ? "amber"
                      : "neutral"
                  }
                >
                  {
                    assignment.submissions.filter((row) => row.score === null)
                      .length
                  }{" "}
                  to grade
                </Chip>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
