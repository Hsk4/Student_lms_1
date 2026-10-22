export const instant = false;

import { Card, Empty, PageHeader } from "@/components/ui/nila";
import { listMyBooks } from "@/actions/student-panel";

export default async function StudentBooksPage() {
  const books = await listMyBooks();

  return (
    <div>
      <PageHeader
        title="Recommended books"
        description="Courseware recommended for your courses. The school does not sell books."
      />

      {books.length === 0 ? (
        <Empty>No recommended books yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {books.map((book) => (
            <Card key={book.id} className="p-4">
              <p className="font-semibold text-foreground">{book.title}</p>
              <p className="text-sm text-muted-foreground">
                {book.author || "Author not listed"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {book.courseLabel}
              </p>
              {book.note ? <p className="mt-2 text-sm">{book.note}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
