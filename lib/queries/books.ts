import { asc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { toBook } from "@/db/mappers";
import { bookCourses, books } from "@/db/schema";
import type { Book, Id } from "@/lib/types";

/**
 * Book reads and writes. Postgres-backed.
 *
 * `courseIds` was an embedded array in Mongo; it is the `book_courses` join
 * table now. A book is therefore always assembled from two queries — row first,
 * links second — which is why every function returns a fully-populated `Book`
 * rather than a bare row.
 */

async function courseIdsFor(
  bookIds: Id[],
  conn: Tx | typeof db,
): Promise<Map<Id, Id[]>> {
  const map = new Map<Id, Id[]>();
  if (bookIds.length === 0) return map;

  const links = await conn
    .select({ bookId: bookCourses.bookId, courseId: bookCourses.courseId })
    .from(bookCourses)
    .where(inArray(bookCourses.bookId, bookIds));

  for (const link of links) {
    const current = map.get(link.bookId);
    if (current) current.push(link.courseId);
    else map.set(link.bookId, [link.courseId]);
  }
  return map;
}

export async function listBooks(conn: Tx | typeof db = db): Promise<Book[]> {
  const rows = await conn.select().from(books).orderBy(asc(books.title));
  const links = await courseIdsFor(
    rows.map((row) => row.id),
    conn,
  );
  return rows.map((row) => toBook(row, links.get(row.id) ?? []));
}

export async function findBookById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Book | null> {
  const [row] = await conn
    .select()
    .from(books)
    .where(eq(books.id, id))
    .limit(1);
  if (!row) return null;
  const links = await courseIdsFor([row.id], conn);
  return toBook(row, links.get(row.id) ?? []);
}

/** Books linked to any of `courseIds` — the student book picker. */
export async function listBooksForCourses(
  courseIds: Id[],
  conn: Tx | typeof db = db,
): Promise<Book[]> {
  if (courseIds.length === 0) return [];

  const links = await conn
    .select({ bookId: bookCourses.bookId })
    .from(bookCourses)
    .where(inArray(bookCourses.courseId, courseIds));

  const bookIds = [...new Set(links.map((link) => link.bookId))];
  if (bookIds.length === 0) return [];

  const rows = await conn
    .select()
    .from(books)
    .where(inArray(books.id, bookIds))
    .orderBy(asc(books.title));
  const byBook = await courseIdsFor(bookIds, conn);
  return rows.map((row) => toBook(row, byBook.get(row.id) ?? []));
}

/**
 * Book → course links, counted per course. The admin course list shows
 * "books: n", which used to be a walk over every embedded `courseIds` array.
 */
export async function countBooksByCourse(
  conn: Tx | typeof db = db,
): Promise<Map<Id, number>> {
  const links = await conn
    .select({ courseId: bookCourses.courseId })
    .from(bookCourses);
  const counts = new Map<Id, number>();
  for (const link of links) {
    counts.set(link.courseId, (counts.get(link.courseId) ?? 0) + 1);
  }
  return counts;
}

async function replaceLinks(
  bookId: Id,
  courseIds: Id[],
  conn: Tx | typeof db,
): Promise<void> {
  await conn.delete(bookCourses).where(eq(bookCourses.bookId, bookId));
  const unique = [...new Set(courseIds)];
  if (unique.length === 0) return;
  await conn
    .insert(bookCourses)
    .values(unique.map((courseId) => ({ bookId, courseId })));
}

export async function createBook(
  input: {
    title: string;
    author?: string | null;
    note?: string | null;
    courseIds: Id[];
  },
  conn: Tx | typeof db = db,
): Promise<Book> {
  const [row] = await conn
    .insert(books)
    .values({
      title: input.title,
      author: input.author ?? null,
      note: input.note ?? null,
    })
    .returning();
  await replaceLinks(row.id, input.courseIds, conn);
  return toBook(row, [...new Set(input.courseIds)]);
}

export async function updateBook(
  id: Id,
  input: {
    title: string;
    author?: string | null;
    note?: string | null;
    courseIds: Id[];
  },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(books)
    .set({
      title: input.title,
      author: input.author ?? null,
      note: input.note ?? null,
    })
    .where(eq(books.id, id));
  await replaceLinks(id, input.courseIds, conn);
}
