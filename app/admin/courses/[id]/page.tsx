export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/queries/admin";
import { PageHeader, Card, Empty } from "@/components/ui/nila";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  return (
    <>
      <PageHeader
        title={course.label}
        description={course.active ? "Active course" : "Hidden course"}
      >
        <Link href="/admin/courses" className="btn-secondary">
          Back to courses
        </Link>
        <Link
          href={`/admin/books?courseId=${course.id}`}
          className="btn-primary"
        >
          Add a recommended book
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Board</h2>
          <p className="mt-1 text-sm">{course.board?.name ?? "-"}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Level</h2>
          <p className="mt-1 text-sm">{course.level?.name ?? "-"}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Subject</h2>
          <p className="mt-1 text-sm">{course.subject?.name ?? "-"}</p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recommended books ({course.books.length})
      </h2>
      {course.books.length === 0 ? (
        <Empty>No books recommended for this course yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {course.books.map((book) => (
                <tr key={book.id}>
                  <td className="font-medium">{book.title}</td>
                  <td>{book.author || "-"}</td>
                  <td className="text-end">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className="btn-ghost h-8"
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

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Materials ({course.materials.length})
      </h2>
      {course.materials.length === 0 ? (
        <Empty>
          This course has no materials. Uploading files arrives in Phase 7; the
          model exists.
        </Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {course.materials.map((material) => (
                <tr key={material.id}>
                  <td className="font-medium">{material.title}</td>
                  <td className="capitalize">
                    {material.type.replace("_", " ")}
                  </td>
                  <td className="text-end">
                    <a
                      href={material.fileUrl}
                      className="btn-ghost h-8"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
