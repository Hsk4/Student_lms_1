export const instant = false;

import Link from "next/link";
import { getCatalogLists, listCourses } from "@/lib/queries/admin";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { BoardForm, BoardRow } from "./board-ui";

export default async function BoardsPage() {
  const { boards } = await getCatalogLists();
  const courses = await listCourses();
  const counts = new Map<string, number>();
  for (const course of courses) {
    counts.set(course.boardId, (counts.get(course.boardId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Boards"
        description="Real exam boards. Qualifications such as O Level are levels, not boards."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {boards.length === 0 ? (
            <Empty>No boards yet. Add the first one on the right.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Board</th>
                    <th>Slug</th>
                    <th>Courses</th>
                    <th>State</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {boards.map((board) => (
                    <BoardRow
                      key={board.id}
                      board={board}
                      courseCount={counts.get(board.id) ?? 0}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-foreground">New board</h2>
          <BoardForm />
        </Card>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Courses live on the{' '}
        <Link href="/admin/courses" className="text-primary">
          Courses
        </Link>{' '}
        page. Levels and subjects are tabs there.
      </p>
    </>
  );
}
