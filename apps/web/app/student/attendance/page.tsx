"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
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
  Stat,
  formatDay,
} from "@/components/ui/nila";
type AttendanceRow = { id: string; date: string; present: boolean; context: string };

export default function StudentAttendancePage() {
  const rowsQuery = useQuery({
    queryKey: ["student", "attendance"],
    queryFn: () => api.get<AttendanceRow[]>("/student/attendance"),
  });
  const rows = rowsQuery.data ?? [];
  const present = rows.filter((row) => row.present).length;
  const rate = rows.length ? Math.round((present / rows.length) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Classes your teacher recorded for you."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sessions" value={rows.length} />
        <Stat label="Present" value={present} />
        <Stat
          label="Rate"
          value={rate === null ? "-" : `${rate}%`}
          hint={rate === null ? "Nothing recorded yet" : undefined}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        History
      </h2>
      {rows.length === 0 ? (
        <Empty>No attendance recorded yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDay(row.date)}</TableCell>
                  <TableCell>{row.context}</TableCell>
                  <TableCell>
                    <Chip tone={row.present ? "green" : "red"}>{row.present ? "Present" : "Absent"}</Chip>
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
