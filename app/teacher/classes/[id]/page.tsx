export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip, Empty, PageHeader, formatDay } from "@/components/ui/nila";
import { getClassDetail } from "@/actions/teacher-panel";
import { EndClassButton } from "../../teacher-forms";

export default async function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Row guard: getClassDetail only returns a class owned by this teacher.
  const detail = await getClassDetail(id);
  if (!detail) notFound();

  return (
    <div>
      <PageHeader
        title={detail.name}
        description={`${detail.courseLabel} / ${detail.schedule || "Schedule not set"}`}
      >
        <Link href="/teacher/classes" className="btn-secondary">
          All classes
        </Link>
        {detail.state === "current" ? (
          <EndClassButton classId={detail.id} />
        ) : null}
      </PageHeader>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Students ({detail.students.length})
      </h2>
      {detail.students.length === 0 ? (
        <Empty>No student accepted into this class yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.students.map((student) => (
                <tr key={student.enrollmentId}>
                  <td>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.email}
                    </p>
                  </td>
                  <td>{student.courseLabel}</td>
                  <td className="text-muted-foreground">
                    {formatDay(student.since)}
                  </td>
                  <td className="text-end">
                    <Link
                      href={`/teacher/students/${student.studentId}`}
                      className="btn-secondary h-8"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Attendance ({detail.attendance.length})
      </h2>
      {detail.attendance.length === 0 ? (
        <Empty>Nothing recorded for this class yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Present</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.attendance.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDay(entry.date)}</td>
                  <td className="tabular-nums">{entry.present}</td>
                  <td className="tabular-nums">{entry.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6">
        <Chip tone={detail.state === "current" ? "green" : "red"}>
          {detail.state}
        </Chip>
      </div>
    </div>
  );
}
