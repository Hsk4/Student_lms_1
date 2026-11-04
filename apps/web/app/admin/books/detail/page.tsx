"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { EditBookForm } from "../book-ui";
import { InlineLoading } from "@/components/shared/skeleton";

type BookDetail = {
  id: string;
  title: string;
  author: string;
  note: string;
  courseIds: string[];
  linked: { id: string; label: string }[];
  allCourses: { id: string; label: string }[];
};

function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const bookQuery = useQuery({
    queryKey: ["admin-book", id],
    queryFn: () => api.get<BookDetail>(`/admin/books/${id}`),
    enabled: Boolean(id),
  });

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No book selected.</p>
    );
  if (bookQuery.isLoading) {
    return <InlineLoading />;
  }
  if (bookQuery.error) {
    return (
      <p className="p-6 text-sm text-status-red">{bookQuery.error.message}</p>
    );
  }
  const book = bookQuery.data;
  if (!book) return null;

  return (
    <>
      <PageHeader title={book.title} description={book.author || undefined}>
        <Link
          href="/admin/books"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
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
              {book.linked.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/courses/detail?id=${item.id}`}
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

export default function BookDetailPage() {
  return (
    <Suspense
      fallback={<InlineLoading />}
    >
      <DetailById />
    </Suspense>
  );
}