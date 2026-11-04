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
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  formatDay,
} from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { InlineLoading } from "@/components/shared/skeleton";

type StudentDetail = {
  id: string;
  name: string;
  email: string;
  enrollments: {
    enrollmentId: string;
    courseLabel: string;
    className: string | null;
    since: string;
  }[];
  attendance: { id: string; date: string; present: number; total: number }[];
  grades: { title: string; score: number; feedback: string }[];
  unpaidTotal: number;
  guardians: { name: string; email: string }[];
};

function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const query = useQuery({
    queryKey: ["teacher", "student", id],
    queryFn: () => api.get<StudentDetail>(`/teacher/students/${id}/detail`),
    enabled: Boolean(id),
  });

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No student selected.</p>
    );
  if (query.isLoading)
    return <InlineLoading />;
  if (query.error)
    return <p className="p-6 text-sm text-status-red">{query.error.message}</p>;
  const detail = query.data;
  if (!detail) return null;

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
        <Link
          href="/teacher/students"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.enrollments.map((enrollment) => (
                <TableRow key={enrollment.enrollmentId}>
                  <TableCell>{enrollment.courseLabel}</TableCell>
                  <TableCell>
                    {enrollment.className ?? (
                      <Chip tone="primary">One-on-one</Chip>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDay(enrollment.since)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Present</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.attendance.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDay(entry.date)}</TableCell>
                      <TableCell className="tabular-nums">
                        {entry.present}/{entry.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

export default function TeacherStudentDetailPage() {
  return (
    <Suspense
      fallback={<InlineLoading />}
    >
      <DetailById />
    </Suspense>
  );
}