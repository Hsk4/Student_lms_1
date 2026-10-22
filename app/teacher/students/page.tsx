export const instant = false;

import Link from "next/link";
import { Card, Chip, Empty, PageHeader, formatDay } from "@/components/ui/nila";
import { listMyStudents } from "@/actions/teacher-panel";

export default async function TeacherStudentsPage() {
  const students = await listMyStudents();

  return (
    <div>
      <PageHeader
        title="My students"
        description="Every student needs an active enrollment with you to appear here."
      />

      {students.length === 0 ? (
        <Empty>No students yet. Accept a request first.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Class</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.enrollmentId}>
                  <td>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.email}
                    </p>
                  </td>
                  <td>{student.courseLabel}</td>
                  <td>
                    {student.className ? (
                      student.className
                    ) : (
                      <Chip tone="primary">One-on-one</Chip>
                    )}
                  </td>
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
    </div>
  );
}
