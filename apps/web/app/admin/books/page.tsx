"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { BookForm } from "./book-ui";
import { InlineLoading } from "@/components/shared/skeleton";

type BookRow = {
  id: string;
  title: string;
  author: string;
  note: string;
  courseIds: string[];
  courses: string[];
};

type CourseRow = { id: string; label: string };

function BooksContent() {
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? undefined;

  const booksQuery = useQuery({
    queryKey: ["admin-books"],
    queryFn: () => api.get<BookRow[]>("/admin/books"),
  });
  const coursesQuery = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => api.get<CourseRow[]>("/admin/courses"),
  });

  const books = booksQuery.data ?? [];
  const courseOptions = (coursesQuery.data ?? []).map((course) => ({
    id: course.id,
    label: course.label,
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        <Link
                          href={`/admin/books/detail?id=${book.id}`}
                          className="font-medium text-primary"
                        >
                          {book.title}
                        </Link>
                        {book.author ? (
                          <p className="text-xs text-muted-foreground">
                            {book.author}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {book.courses.length === 0 ? (
                          <span className="text-muted-foreground">
                            No course
                          </span>
                        ) : (
                          <ul className="space-y-0.5">
                            {book.courses.map((label) => (
                              <li key={label}>{label}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Link
                          href={`/admin/books/detail?id=${book.id}`}
                          className="text-primary hover:bg-tint hover:text-tint-foreground h-8"
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

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-foreground">New book</h2>
          <BookForm courses={courseOptions} preselect={courseId} />
        </Card>
      </div>
    </>
  );
}

export default function BooksPage() {
  return (
    <Suspense
      fallback={<InlineLoading />}
    >
      <BooksContent />
    </Suspense>
  );
}