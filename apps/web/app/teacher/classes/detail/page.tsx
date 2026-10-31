"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, Chip, Empty, PageHeader, formatDay } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { EndClassButton } from "../../teacher-forms";

type ClassDetail = {
  id: string;
  name: string;
  courseLabel: string;
  schedule: string;
  state: string;
  students: {
    enrollmentId: string;
    studentId: string;
    name: string;
    email: string;
    courseLabel: string;
    since: string;
  }[];
  attendance: { id: string; date: string; present: number; total: number }[];
};

function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const query = useQuery({
    queryKey: ["teacher", "class", id],
    queryFn: () => api.get<ClassDetail>(`/teacher/classes/${id}`),
    enabled: Boolean(id),
  });

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No class selected.</p>
    );
  if (query.isLoading)
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  if (query.error)
    return <p className="p-6 text-sm text-status-red">{query.error.message}</p>;
  const detail = query.data;
  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.name}
        description={`${detail.courseLabel} / ${detail.schedule || "Schedule not set"}`}
      >
        <Link
          href="/teacher/classes"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Since</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.students.map((student) => (
                <TableRow key={student.enrollmentId}>
                  <TableCell>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.email}
                    </p>
                  </TableCell>
                  <TableCell>{student.courseLabel}</TableCell>
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

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Attendance ({detail.attendance.length})
      </h2>
      {detail.attendance.length === 0 ? (
        <Empty>Nothing recorded for this class yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.attendance.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDay(entry.date)}</TableCell>
                  <TableCell className="tabular-nums">
                    {entry.present}
                  </TableCell>
                  <TableCell className="tabular-nums">{entry.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

export default function TeacherClassDetailPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-muted-foreground">Loading...</p>}
    >
      <DetailById />
    </Suspense>
  );
}
