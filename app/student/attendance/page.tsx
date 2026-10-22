export const instant = false;

import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDay,
} from "@/components/ui/nila";
import { listMyAttendance } from "@/actions/student-panel";

export default async function StudentAttendancePage() {
  const rows = await listMyAttendance();
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
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDay(row.date)}</td>
                  <td>{row.context}</td>
                  <td>
                    <Chip tone={row.present ? "green" : "red"}>{row.present ? "Present" : "Absent"}</Chip>
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
