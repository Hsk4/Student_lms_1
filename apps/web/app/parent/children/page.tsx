export const instant = false;

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import {
  Card,
  Empty,
  PageHeader,
  Score,
  formatDay,
} from "@/components/ui/nila";
import { listChildOverviews } from "@/actions/parent-panel";

export default async function ParentChildrenPage() {
  const children = await listChildOverviews();

  return (
    <div>
      <PageHeader
        title="Children"
        description="One row per child linked to your account."
      />

      {children.length === 0 ? (
        <Empty>No child is linked to your account yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Board / level</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Latest score</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {children.map((child) => (
                <TableRow key={child.id}>
                  <TableCell>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {[child.boardName, child.levelName]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </TableCell>
                  <TableCell>
                    {child.teachers.length
                      ? child.teachers.map((teacher) => teacher.name).join(", ")
                      : "Not assigned"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {child.attendanceRate === null
                      ? "-"
                      : `${child.attendanceRate}%`}
                  </TableCell>
                  <TableCell>
                    {child.latestGrades[0] ? (
                      <Score value={child.latestGrades[0].score} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                    {child.latestGrades[0]?.gradedAt ? (
                      <span className="ms-2 text-xs text-muted-foreground">
                        {formatDay(child.latestGrades[0].gradedAt)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-end">
                    <Link
                      href={`/parent/children/${child.id}`}
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
