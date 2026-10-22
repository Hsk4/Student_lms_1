export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  formatDay,
} from "@/components/ui/nila";
import { getStudentDetail } from "@/actions/teacher-panel";

export default async function TeacherStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Row guard: getStudentDetail requires an active enrollment with this teacher.
  const detail = await getStudentDetail(id);
  if (!detail) notFound();

  const average = detail.grades.length
    ? Math.round(
        detail.grades.reduce((sum, grade) => sum + grade.score, 0) /
          detail.grades.length,
      )
    : null;
  const present = detail.attendance.reduce(
    (sum, entry) => sum + entry.present,
    0,
  );
  const total = detail.attendance.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div>
      <PageHeader title={detail.name} description={detail.email}>
        <Link href="/teacher/students" className="btn-secondary">
          All students
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Average score
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {average === null ? "-" : `${average}%`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attendance
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {total === 0 ? "-" : `${Math.round((present / total) * 100)}%`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unpaid fees
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            PKR {detail.unpaidTotal.toLocaleString("en-PK")}
          </p>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Enrollments
        </h2>
        <Card className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Class</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {detail.enrollments.map((enrollment) => (
                <tr key={enrollment.enrollmentId}>
                  <td>{enrollment.courseLabel}</td>
                  <td>
                    {enrollment.className ?? (
                      <Chip tone="primary">One-on-one</Chip>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    {formatDay(enrollment.since)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Grades
          </h2>
          {detail.grades.length === 0 ? (
            <Empty>No graded work yet.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {detail.grades.map((grade, index) => (
                <div
                  key={`${grade.title}-${index}`}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {grade.title}
                    </p>
                    {grade.feedback ? (
                      <p className="text-xs text-muted-foreground">
                        {grade.feedback}
                      </p>
                    ) : null}
                  </div>
                  <Score value={grade.score} />
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attendance
          </h2>
          {detail.attendance.length === 0 ? (
            <Empty>No attendance recorded.</Empty>
          ) : (
            <Card className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.attendance.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDay(entry.date)}</td>
                      <td className="tabular-nums">
                        {entry.present}/{entry.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guardians
          </h2>
          {detail.guardians.length === 0 ? (
            <Empty>The student has not linked a parent yet.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {detail.guardians.map((guardian) => (
                <div key={guardian.email} className="p-3">
                  <p className="text-sm font-medium">{guardian.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {guardian.email}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
