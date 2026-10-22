export const instant = false;

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
          <table className="table">
            <thead>
              <tr>
                <th>Child</th>
                <th>Board / level</th>
                <th>Teacher</th>
                <th>Attendance</th>
                <th>Latest score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {children.map((child) => (
                <tr key={child.id}>
                  <td>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.email}
                    </p>
                  </td>
                  <td>
                    {[child.boardName, child.levelName]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </td>
                  <td>
                    {child.teachers.length
                      ? child.teachers.map((teacher) => teacher.name).join(", ")
                      : "Not assigned"}
                  </td>
                  <td className="tabular-nums">
                    {child.attendanceRate === null
                      ? "-"
                      : `${child.attendanceRate}%`}
                  </td>
                  <td>
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
                  </td>
                  <td className="text-end">
                    <Link
                      href={`/parent/children/${child.id}`}
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
