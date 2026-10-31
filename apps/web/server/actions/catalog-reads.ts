"use server";

import { getCurrentUser } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/guards";
import { findUserByClerkId } from "@/lib/queries/users";
import { listActiveBoards, listBoards } from "@/lib/queries/boards";
import { listActiveLevels, listLevels } from "@/lib/queries/levels";
import { listActiveSubjects, listSubjects } from "@/lib/queries/subjects";
import {
  findActiveCourseIds,
  findCourseById,
  listCourseRows,
  listCoursesBySubjectName,
} from "@/lib/queries/courses";
import { listBooksForCourses } from "@/lib/queries/books";
import { recordIdSchema } from "@lms/shared";

export type CatalogOption = { id: string; label: string };

export type CourseOption = {
  id: string;
  label: string;
  boardId: string;
  levelId: string;
  subjectId: string;
};

function label(...parts: (string | undefined | null)[]) {
  return parts.filter(Boolean).join(" / ");
}

/**
 * Course labels need the three catalog names, so every getter below loads the
 * small catalog tables once and joins in memory. That is cheaper than a four-way
 * SQL join for tables that hold tens of rows, and it keeps the shape identical
 * to what the pages already render.
 */
async function catalogNames() {
  const [boards, levels, subjects] = await Promise.all([
    listBoards(),
    listLevels(),
    listSubjects(),
  ]);
  return {
    boardName: new Map(boards.map((b) => [b.id, b.name])),
    levelName: new Map(levels.map((l) => [l.id, l.name])),
    subjectName: new Map(subjects.map((s) => [s.id, s.name])),
  };
}

/** Public form options: one board list, one level list, subjects, and nothing else. */
export async function getFormOptions() {
  const user = await getCurrentUser();
  if (!user) return { boards: [], levels: [], subjects: [] };

  const [boards, levels, subjects] = await Promise.all([
    listActiveBoards(),
    listActiveLevels(),
    listActiveSubjects(),
  ]);

  return {
    boards: boards.map<CatalogOption>((b) => ({ id: b.id, label: b.name })),
    levels: levels.map<CatalogOption>((l) => ({ id: l.id, label: l.name })),
    subjects: subjects.map<CatalogOption>((s) => ({ id: s.id, label: s.name })),
  };
}

/** Active courses available to catalog managers. Student matching has its own guarded getter. */
export async function getCourseOptions(filter?: {
  boardId?: string;
  levelId?: string;
}) {
  await requireRole(["super_admin", "admin"]);

  const boardId = filter?.boardId
    ? recordIdSchema.parse(filter.boardId)
    : undefined;
  const levelId = filter?.levelId
    ? recordIdSchema.parse(filter.levelId)
    : undefined;

  const [courses, names] = await Promise.all([
    listCourseRows({ active: true, boardId, levelId }),
    catalogNames(),
  ]);

  return courses.map<CourseOption>((c) => ({
    id: c.id,
    boardId: c.boardId,
    levelId: c.levelId,
    subjectId: c.subjectId,
    label: label(
      names.boardName.get(c.boardId),
      names.levelName.get(c.levelId),
      names.subjectName.get(c.subjectId),
      c.medium ?? undefined,
    ),
  }));
}

/** Active student courses are narrowed to the student's board and level. */
export async function getStudentCourseOptions() {
  const session = await requireRole(["student"]);
  const user = await findUserByClerkId(session.clerkId);
  const { boardId, levelId } = user?.student ?? { boardId: null, levelId: null };
  if (!boardId || !levelId) return [];

  const [courses, subjects] = await Promise.all([
    listCoursesBySubjectName({ boardId, levelId, active: true }),
    listSubjects(),
  ]);
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return courses.map((course) => ({
    id: course.id,
    label: `${names.get(course.subjectId) ?? "Subject"}${
      course.medium ? ` / ${course.medium}` : ""
    }`,
  }));
}

/**
 * Books for the courses a student asked about. The student may only reach books
 * for courses on their own board and level; every requested id must be permitted,
 * so this is an allow-list check rather than a filter.
 */
export async function getBookOptions(courseIds: string[]) {
  const session = await requireRole(["student"]);
  const user = await findUserByClerkId(session.clerkId);
  const { boardId, levelId } = user?.student ?? { boardId: null, levelId: null };

  const permittedCourseIds =
    boardId && levelId
      ? await findActiveCourseIds(
          (await listCoursesBySubjectName({ boardId, levelId, active: true })).map(
            (course) => course.id,
          ),
        )
      : [];

  const requestedIds = courseIds.map((id) => recordIdSchema.parse(id));
  const permitted = new Set(permittedCourseIds);
  if (requestedIds.some((id) => !permitted.has(id))) {
    throw new Error("Course access denied");
  }

  const books = await listBooksForCourses(requestedIds);
  return books.map((book) => ({
    id: book.id,
    label: book.author ? `${book.title} - ${book.author}` : book.title,
    courseIds: book.courseIds,
  }));
}

/** Single course, for detail pages that only need the label. */
export async function getCourseOption(id: string) {
  const course = await findCourseById(recordIdSchema.parse(id));
  if (!course) return null;
  const names = await catalogNames();
  return {
    id: course.id,
    label: label(
      names.boardName.get(course.boardId),
      names.levelName.get(course.levelId),
      names.subjectName.get(course.subjectId),
      course.medium ?? undefined,
    ),
  } satisfies CatalogOption;
}
