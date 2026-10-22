export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/queries/admin";
import { PageHeader, Card } from "@/components/ui/nila";
import { EditBookForm } from "../book-ui";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <>
      <PageHeader title={book.title} description={book.author || undefined}>
        <Link href="/admin/books" className="btn-secondary">
          Back to books
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Recommended for
          </h2>
          {book.linked.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No course attached yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {book.linked.map((item: { id: string; label: string }) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/courses/${item.id}`}
                    className="text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {book.note ? (
            <p className="mt-4 rounded-[var(--radius-card)] bg-surface px-3 py-2 text-sm text-muted-foreground">
              {book.note}
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Edit book
          </h2>
          <EditBookForm book={book} courses={book.allCourses} />
        </Card>
      </div>
    </>
  );
}
