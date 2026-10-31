/**
 * Row → app-type mappers.
 *
 * This is the only place that knows both Drizzle's row shape and the app's
 * row types. Every mapper is total and side-effect free, so a query module can
 * be read as "select rows, map rows, return".
 *
 * Drizzle infers `select()` results from the table; these functions take the
 * inferred shape explicitly so a schema change fails here, loudly, instead of
 * quietly leaking a snake_case column into a page.
 */

import type { InferSelectModel } from "drizzle-orm";
import type { boards, books, courses, levels, materials, subjects } from "./schema";
import type {
  Board,
  Book,
  Course,
  Id,
  Level,
  Material,
  Subject,
} from "@/lib/types";

type SubjectRow = InferSelectModel<typeof subjects>;

export function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type BoardRow = InferSelectModel<typeof boards>;

export function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type LevelRow = InferSelectModel<typeof levels>;

export function toLevel(row: LevelRow): Level {
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type CourseRow = InferSelectModel<typeof courses>;

/**
 * `medium` was `""` in Mongo for "no medium"; the column is nullable, so the
 * app type's `string | null` is a straight pass-through — no coercion needed.
 */
export function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    boardId: row.boardId,
    levelId: row.levelId,
    subjectId: row.subjectId,
    medium: row.medium,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * `Book` carries `courseIds` from the `book_courses` relation, so the mapper
 * takes them as an argument: the row alone cannot answer the question.
 */
export function toBook(row: InferSelectModel<typeof books>, courseIds: Id[] = []): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    courseIds,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type MaterialRow = InferSelectModel<typeof materials>;

export function toMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    type: row.type,
    fileUrl: row.fileUrl,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
