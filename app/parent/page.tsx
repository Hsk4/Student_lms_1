export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Notice,
  Score,
  Stat,
  formatDate,
} from "@/components/ui/nila";
import { listChildOverviews } from "@/actions/parent-panel";
import { requireRequestTime } from "@/lib/auth/panels";
import { RequestMeetingForm } from "./parent-forms";

export default async function ParentDashboardPage() {
  // "Upcoming meeting" depends on the current time.
  await requireRequestTime();
  const children = await listChildOverviews();

  const totalDue = children.reduce((sum, child) => sum + child.dueAmount, 0);
  const rates = children
    .map((child) => child.attendanceRate)
    .filter((rate): rate is number => rate !== null);
  const averageAttendance = rates.length
    ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
    : null;

  return (
    <div>
      <PageHeader
        title="My children"
        description="Read-only view of each child's teacher, progress, attendance and fees."
      >
        <Link href="/parent/meetings" className="btn-primary">
          Request a meeting
        </Link>
      </PageHeader>

      {children.length === 0 ? (
        <Empty>
          No child is linked to your account yet. Ask your child to invite you
          from their &quot;Parent access&quot; page, or contact the school
          office.
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Children" value={children.length} />
            <Stat
              label="Average attendance"
              value={averageAttendance === null ? "-" : `${averageAttendance}%`}
            />
            <Stat
              label="Outstanding fees"
              value={`PKR ${totalDue.toLocaleString("en-PK")}`}
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      {child.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {[child.boardName, child.levelName]
                        .filter(Boolean)
                        .join(" / ") || "Board not set"}
                    </p>
                  </div>
                  <Link
                    href={`/parent/children/${child.id}`}
                    className="btn-secondary h-9"
                  >
                    Open
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Teacher</dt>
                    <dd>
                      {child.teachers.length
                        ? child.teachers
                            .map((teacher) => teacher.name)
                            .join(", ")
                        : "Not assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Class</dt>
                    <dd>
                      {child.teachers.length
                        ? child.teachers
                            .map((teacher) => teacher.className ?? "One-on-one")
                            .join(", ")
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Attendance
                    </dt>
                    <dd className="tabular-nums">
                      {child.attendanceRate === null
                        ? "No records"
                        : `${child.attendanceRate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fees</dt>
                    <dd className="tabular-nums">
                      {child.dueAmount === 0
                        ? "Nothing due"
                        : `PKR ${child.dueAmount.toLocaleString("en-PK")} due`}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest grades
                  </p>
                  {child.latestGrades.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No graded work yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {child.latestGrades.slice(0, 3).map((grade, index) => (
                        <li
                          key={`${grade.title}-${index}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">{grade.title}</span>
                          <Score value={grade.score} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  {child.nextMeeting ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        Meeting with {child.nextMeeting.teacherName}:{" "}
                        <span className="font-medium">
                          {child.nextMeeting.when.includes("T")
                            ? formatDate(child.nextMeeting.when)
                            : child.nextMeeting.when}
                        </span>
                      </p>
                      <Chip tone="amber">
                        {child.nextMeeting.when.includes("T")
                          ? "Scheduled"
                          : "Requested"}
                      </Chip>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No meeting scheduled.
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 p-5">
            <h2 className="text-sm font-semibold">
              Request a meeting with a teacher
            </h2>
            <div className="mt-3 max-w-md">
              <RequestMeetingForm
                childRows={children.map(({ id, name }) => ({ id, name }))}
              />
            </div>
          </Card>

          {children.some((child) => child.teachers.length === 0) ? (
            <div className="mt-6">
              <Notice>
                A child without a teacher is waiting for the office to assign
                one. The child picks the teacher from their own panel.
              </Notice>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
