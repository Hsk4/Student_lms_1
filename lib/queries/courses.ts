import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { toCourse } from "@/db/mappers";
import { courses } from "@/db/schema";
import type { Course, Id } from "@/lib/types";

/**
 * Course reads and writes. Postgres-backed.
 *
 * This module exists to kill the cross-store bug: `createCourse` used to check
 * the subject with Mongoose while subjects had already moved to Postgres, so a
 * freshly created subject was invisible and course creation always failed.
 * Every existence check below is in the same database it validates.
 */

/** The old Mongo unique index treated `""` as a value; the column is `NULL` now. */
export function normalizeMedium(medium?: string | null): string | null {
  const trimmed = medium?.trim();
  return trimmed ? trimmed : null;
}

export async function listCourses(
  conn: Tx | typeof db = db,
  limit = 500,
): Promise<Course[]> {
  const rows = await conn
    .select()
    .from(courses)
    .orderBy(desc(courses.createdAt))
    .limit(limit);
  return rows.map(toCourse);
}

/** Courses filtered by active state, optionally narrowed to a board and/or level. */
export async function listCourseRows(
  filter: { active?: boolean; boardId?: Id; levelId?: Id } = {},
  conn: Tx | typeof db = db,
  limit = 500,
): Promise<Course[]> {
  const where = [
    filter.active === undefined ? undefined : eq(courses.active, filter.active),
    filter.boardId === undefined
      ? undefined
      : eq(courses.boardId, filter.boardId),
    filter.levelId === undefined
      ? undefined
      : eq(courses.levelId, filter.levelId),
  ].filter(
    (clause): clause is NonNullable<typeof clause> => clause !== undefined,
  );

  const rows = await conn
    .select()
    .from(courses)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(courses.createdAt))
    .limit(limit);
  return rows.map(toCourse);
}

/** Courses a student may pick: their own board and level, still active. */
export async function listCoursesForStudent(
  boardId: Id,
  levelId: Id,
  conn: Tx | typeof db = db,
): Promise<Course[]> {
  return listCourseRows({ active: true, boardId, levelId }, conn);
}

export async function findCourseById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Course | null> {
  const [row] = await conn
    .select()
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  return row ? toCourse(row) : null;
}

/**
 * Returns only the ids that exist **and** are active, so a caller can compare
 * the count against what it asked for. Used by course and book validation.
 */
export async function findActiveCourseIds(
  ids: Id[],
  conn: Tx | typeof db = db,
): Promise<Id[]> {
  if (ids.length === 0) return [];
  const rows = await conn
    .select({ id: courses.id })
    .from(courses)
    .where(and(inArray(courses.id, ids), eq(courses.active, true)));
  return rows.map((row) => row.id);
}

export async function createCourse(
  input: {
    boardId: Id;
    levelId: Id;
    subjectId: Id;
    medium?: string | null;
    active: boolean;
  },
  conn: Tx | typeof db = db,
): Promise<Course> {
  const [row] = await conn
    .insert(courses)
    .values({
      boardId: input.boardId,
      levelId: input.levelId,
      subjectId: input.subjectId,
      medium: normalizeMedium(input.medium),
      active: input.active,
    })
    .returning();
  return toCourse(row);
}

export async function updateCourse(
  id: Id,
  input: {
    boardId: Id;
    levelId: Id;
    subjectId: Id;
    medium?: string | null;
    active: boolean;
  },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(courses)
    .set({
      boardId: input.boardId,
      levelId: input.levelId,
      subjectId: input.subjectId,
      medium: normalizeMedium(input.medium),
      active: input.active,
    })
    .where(eq(courses.id, id));
}

export async function setCourseActive(
  id: Id,
  active: boolean,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(courses).set({ active }).where(eq(courses.id, id));
}

/** Alphabetical by subject name — the shape the student picker used to sort into. */
export async function listCoursesBySubjectName(
  filter: { active?: boolean; boardId?: Id; levelId?: Id },
  conn: Tx | typeof db = db,
): Promise<Course[]> {
  const where = [
    filter.active === undefined ? undefined : eq(courses.active, filter.active),
    filter.boardId === undefined
      ? undefined
      : eq(courses.boardId, filter.boardId),
    filter.levelId === undefined
      ? undefined
      : eq(courses.levelId, filter.levelId),
  ].filter(
    (clause): clause is NonNullable<typeof clause> => clause !== undefined,
  );

  const rows = await conn
    .select()
    .from(courses)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(courses.subjectId));
  return rows.map(toCourse);
}
