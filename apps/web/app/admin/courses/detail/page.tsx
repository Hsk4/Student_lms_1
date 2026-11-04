"use client";

import { Suspense } from "react";
import Link from "next/link";
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

type CourseDetail = {
  id: string;
  label: string;
  active: boolean;
  board: { name: string } | null;
  level: { name: string } | null;
  subject: { name: string } | null;
  books: { id: string; title: string; author: string }[];
  materials: { id: string; title: string; type: string; fileUrl: string }[];
};

function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const courseQuery = useQuery({
    queryKey: ["admin-course", id],
    queryFn: () => api.get<CourseDetail>(`/admin/courses/${id}`),
    enabled: Boolean(id),
  });

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No course selected.</p>
    );
  if (courseQuery.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  }
  if (courseQuery.error) {
    return (
      <p className="p-6 text-sm text-status-red">{courseQuery.error.message}</p>
    );
  }
  const course = courseQuery.data;
  if (!course) return null;

  return (
    <>
      <PageHeader
        title={course.label}
        description={course.active ? "Active course" : "Hidden course"}
      >
        <Link
          href="/admin/courses"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
          Back to courses
        </Link>
        <Link
          href={`/admin/books?courseId=${course.id}`}
          className="btn btn-primary"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.books.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell>{book.author || "-"}</TableCell>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">
                    {material.title}
                  </TableCell>
                  <TableCell className="capitalize">
                    {material.type.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-end">
                    <a
                      href={material.fileUrl}
                      className="text-primary hover:bg-tint hover:text-tint-foreground h-8"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-muted-foreground">Loading...</p>}
    >
      <DetailById />
    </Suspense>
  );
}
