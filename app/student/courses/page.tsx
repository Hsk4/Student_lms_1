export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
import { listMyCourses } from "@/actions/student-panel";

export default async function StudentCoursesPage() {
  const courses = await listMyCourses();
  const active = courses.filter((item) => item.state === "active");
  const history = courses.filter((item) => item.state !== "active");

  return (
    <div>
      <PageHeader
        title="My courses"
        description="Courses you are enrolled in and their teachers."
      >
        <Link href="/student/teachers" className="btn-secondary">
          Browse teachers
        </Link>
      </PageHeader>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Active ({active.length})
      </h2>
      {active.length === 0 ? (
        <Empty>
          No active course yet.{" "}
          <Link
            href="/student/teachers"
            className="font-medium text-primary hover:underline"
          >
            Pick a teacher
          </Link>{" "}
          to start.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((course) => (
            <Card key={course.enrollmentId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {course.courseLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Teacher: {course.teacherName}
                  </p>
                </div>
                <Chip tone="green">Active</Chip>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Class</dt>
                  <dd>{course.className ?? "One-on-one"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Schedule</dt>
                  <dd>{course.schedule || "To be set"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Medium</dt>
                  <dd>{course.medium || "English"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Started</dt>
                  <dd>{formatDay(course.decidedAt ?? course.requestedAt)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      {history.length ? (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History ({history.length})
          </h2>
          <Card className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Teacher</th>
                  <th>State</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {history.map((course) => (
                  <tr key={course.enrollmentId}>
                    <td>{course.courseLabel}</td>
                    <td>{course.teacherName}</td>
                    <td>
                      <Chip tone={toneFor(course.state)}>{course.state}</Chip>
                    </td>
                    <td className="text-muted-foreground">
                      {formatDay(course.requestedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
