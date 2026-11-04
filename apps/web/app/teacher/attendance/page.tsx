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
import { Card, Empty, PageHeader, Stat, formatDay } from "@/components/ui/nila";
import { AttendanceForm, toStudentOptions } from "../teacher-forms";

type AttendanceEntry = { id: string; date: string; present: number; total: number };
type StudentRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  courseId: string;
  courseLabel: string;
};
type TeacherClass = { id: string; name: string; courseId: string; courseLabel: string; state: string };

export default function TeacherAttendancePage() {
  const attendanceQuery = useAsync(
    () => api.get<AttendanceEntry[]>("/teacher/attendance"),
    [],
  );
  const classesQuery = useAsync(
    () => api.get<TeacherClass[]>("/teacher/classes"),
    [],
  );
  const studentsQuery = useAsync(
    () => api.get<StudentRow[]>("/teacher/students"),
    [],
  );

  const attendance = attendanceQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const present = attendance.reduce((sum, entry) => sum + entry.present, 0);
  const total = attendance.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Record who attended a class or a one-on-one session."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sessions recorded" value={attendance.length} />
        <Stat label="Student slots" value={total} />
        <Stat
          label="Present rate"
          value={total ? `${Math.round((present / total) * 100)}%` : "-"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent sessions
          </h2>
          {attendance.length === 0 ? (
            <Empty>No attendance recorded yet.</Empty>
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
                  {attendance.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDay(entry.date)}</TableCell>
                      <TableCell className="tabular-nums">{entry.present}</TableCell>
                      <TableCell className="tabular-nums">{entry.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Record attendance</h2>
          {classes.length === 0 && students.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing to record yet.
            </p>
          ) : (
            <AttendanceForm classes={classes} students={toStudentOptions(students)} />
          )}
        </Card>
      </div>
    </div>
  );
}
