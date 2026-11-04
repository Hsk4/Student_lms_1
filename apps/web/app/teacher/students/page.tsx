"use client";

import { useAsync } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import { Card, Chip, Empty, PageHeader, formatDay } from "@/components/ui/nila";
type StudentRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  email: string;
  courseLabel: string;
  className: string | null;
  since: string;
};

export default function TeacherStudentsPage() {
  const studentsQuery = useAsync(
    () => api.get<StudentRow[]>("/teacher/students"),
    [],
  );
  const students = studentsQuery.data ?? [];

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Since</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.enrollmentId}>
                  <TableCell>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.email}
                    </p>
                  </TableCell>
                  <TableCell>{student.courseLabel}</TableCell>
                  <TableCell>
                    {student.className ? (
                      student.className
                    ) : (
                      <Chip tone="primary">One-on-one</Chip>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDay(student.since)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Link
                      href={`/teacher/students/detail?id=${student.studentId}`}
                      className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary h-8"
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
