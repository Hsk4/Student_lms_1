export const instant = false;

import Link from "next/link";
import { listBooks, listCourses, courseLabel } from "@/lib/queries/admin";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { BookForm } from "./book-ui";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;
  const books = await listBooks();
  const courses = await listCourses();
  const courseOptions = courses.map((course) => ({
    id: course.id,
    label: courseLabel(course),
  }));

  return (
    <>
      <PageHeader
        title="Books"
        description="Recommended courseware. Students buy them themselves, so there is no price here."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {books.length === 0 ? (
            <Empty>No books yet.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Courses</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id}>
                      <td>
                        <Link
                          href={`/admin/books/${book.id}`}
                          className="font-medium text-primary"
                        >
                          {book.title}
                        </Link>
                        {book.author ? (
                          <p className="text-xs text-muted-foreground">
                            {book.author}
                          </p>
                        ) : null}
                      </td>
                      <td className="text-sm">
                        {book.courses.length === 0 ? (
                          <span className="text-muted-foreground">
                            No course
                          </span>
                        ) : (
                          <ul className="space-y-0.5">
                            {book.courses.map((label: string) => (
                              <li key={label}>{label}</li>
                            ))}
                          </ul>
                        )}
                      </td>
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
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-foreground">New book</h2>
          <BookForm courses={courseOptions} preselect={courseId} />
        </Card>
      </div>
    </>
  );
}
