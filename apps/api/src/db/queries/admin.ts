import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boards } from "@/db/schema";
import type { UserRole } from "@/db/types";

import {
  countOpenRequests,
  listAccessRequests as listRequestRows,
} from "@/db/queries/access-requests";
import { listAuditLogs } from "@/db/queries/audit-logs";
import {
  countBooksByCourse,
  findBookById,
  listBooks as listBookRows,
} from "@/db/queries/books";
import { listBoards } from "@/db/queries/boards";
import {
  findCourseById,
  listCourses as listCourseRows,
} from "@/db/queries/courses";
import { listLevels } from "@/db/queries/levels";
import { listMaterialsForCourse } from "@/db/queries/materials";
import {
  listInvitesWithStudent,
  type ParentInviteRow,
} from "@/db/queries/parent-invites";
import { listSubjects } from "@/db/queries/subjects";
import {
  countUsers,
  listAllUsers,
  listUsersByStatus,
  listUsersByIds,
} from "@/db/queries/users";

/**
 * Admin panel reads. Postgres-backed.
 *
 * Everything here used to hit Mongoose. The shapes are unchanged — the pages are
 * the contract — but the joins happen in SQL rather than in memory.
 */

export async function listPendingUsers() {
  return listUsersByStatus("pending");
}

export type RequestRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  note?: string;
  state: string;
  createdAt: string;
  board?: string;
  level?: string;
  subjects: string;
  userStatus: string;
  userRole: string | null;
  requestedRole: string | null;
};

export async function listAccessRequests(
  state: "open" | "approved" | "rejected",
): Promise<RequestRow[]> {


  const requests = await listRequestRows(state);
  if (requests.length === 0) return [];

  const [requestUsers, allBoards, allLevels, allSubjects] = await Promise.all([
    listUsersByIds([...new Set(requests.map((request) => request.userId))]),
    listBoards(),
    listLevels(),
    listSubjects(),
  ]);

  const usersById = new Map(requestUsers.map((user) => [user.id, user]));
  const boardNames = new Map(allBoards.map((item) => [item.id, item.name]));
  const levelNames = new Map(allLevels.map((item) => [item.id, item.name]));
  const subjectNames = new Map(allSubjects.map((item) => [item.id, item.name]));

  return requests.map((request) => {
    const user = usersById.get(request.userId);
    return {
      id: request.id,
      userId: request.userId,
      name: request.name,
      email: request.email,
      note: request.note ?? undefined,
      state: request.state,
      createdAt: request.createdAt.toISOString(),
      board: request.boardId ? boardNames.get(request.boardId) : undefined,
      level: request.levelId ? levelNames.get(request.levelId) : undefined,
      subjects: request.subjectIds
        .map((id) => subjectNames.get(id) ?? "-")
        .join(", "),
      userStatus: user?.status ?? "unknown",
      userRole: user?.role ?? null,
      requestedRole: request.requestedRole,
    };
  });
}



export async function listUsers(filter?: {
  status?: string;
  role?: string;
  q?: string;
}) {
  const found = await listAllUsers(filter);

  const [allBoards, allLevels] = await Promise.all([
    listBoards(),
    listLevels(),
  ]);
  const boardNames = new Map(allBoards.map((item) => [item.id, item.name]));
  const levelNames = new Map(allLevels.map((item) => [item.id, item.name]));

  return found.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role ?? null) as UserRole | null,
    status: user.status,
    onboarded: user.onboarded,
    createdAt: user.createdAt.toISOString(),
    board: user.student.boardId
      ? boardNames.get(user.student.boardId)
      : undefined,
    level: user.student.levelId
      ? levelNames.get(user.student.levelId)
      : undefined,
    rejectionReason: user.rejectionReason ?? undefined,
  }));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

/** Total for the filtered list — `listUsers` is capped, so it cannot answer this. */
export async function countUsersFor(filter?: {
  status?: string;
  role?: string;
  q?: string;
}) {
  return countUsers(filter);
}

/**
 * The four tiles above the Users table. Each is a `count(*)` on an indexed
 * column, run in parallel, so the summary costs one round trip and no rows.
 */
export async function getUserCounts() {
  const [all, active, pending, teachers] = await Promise.all([
    countUsers(),
    countUsers({ status: "active" }),
    countUsers({ status: "pending" }),
    countUsers({ role: "teacher" }),
  ]);
  return { all, active, pending, teachers };
}

export async function listAuditLog() {
  const entries = await listAuditLogs();
  const actors = await listUsersByIds([
    ...new Set(entries.map((entry) => entry.actorId)),
  ]);
  const actorsById = new Map(
    actors.map((actor) => [actor.id, { name: actor.name, email: actor.email }]),
  );
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    actor: actorsById.get(entry.actorId),
    before: entry.before,
    after: entry.after,
    at: entry.at.toISOString(),
  }));
}

export type { ParentInviteRow };

/** Admin guardian-link-codes table: every invite, newest first, student joined. */
export async function listParentInvites(): Promise<ParentInviteRow[]> {
  return listInvitesWithStudent();
}

export type CatalogLists = {
  boards: { id: string; name: string; slug: string; active: boolean }[];
  levels: { id: string; name: string; order: number; active: boolean }[];
  subjects: { id: string; name: string; slug: string; active: boolean }[];
};

export async function getCatalogLists(): Promise<CatalogLists> {
  const [allBoards, allLevels, allSubjects] = await Promise.all([
    listBoards(),
    listLevels(),
    listSubjects(),
  ]);
  return {
    boards: allBoards.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      active: item.active,
    })),
    levels: allLevels.map((item) => ({
      id: item.id,
      name: item.name,
      order: item.order,
      active: item.active,
    })),
    subjects: allSubjects.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      active: item.active,
    })),
  };
}

export type CourseRow = {
  id: string;
  boardId: string;
  board: string;
  levelId: string;
  level: string;
  levelOrder: number;
  subjectId: string;
  subject: string;
  medium: string;
  active: boolean;
  books: number;
};

export async function listCourses(): Promise<CourseRow[]> {
  const [
    { boards: allBoards, levels: allLevels, subjects: allSubjects },
    courses,
    bookCounts,
  ] = await Promise.all([
    getCatalogLists(),
    listCourseRows(),
    countBooksByCourse(),
  ]);

  const boardNames = new Map(allBoards.map((item) => [item.id, item.name]));
  const levelsById = new Map(allLevels.map((item) => [item.id, item]));
  const subjectNames = new Map(allSubjects.map((item) => [item.id, item.name]));

  return courses.map((course) => {
    const level = levelsById.get(course.levelId);
    return {
      id: course.id,
      boardId: course.boardId,
      board: boardNames.get(course.boardId) ?? "-",
      levelId: course.levelId,
      level: level?.name ?? "-",
      levelOrder: level?.order ?? 999,
      subjectId: course.subjectId,
      subject: subjectNames.get(course.subjectId) ?? "-",
      medium: course.medium ?? "",
      active: course.active,
      books: bookCounts.get(course.id) ?? 0,
    };
  });
}

export function courseLabel(course: CourseRow) {
  return `${course.board} / ${course.level} / ${course.subject}${
    course.medium ? ` / ${course.medium}` : ""
  }`;
}

export async function listBooks() {
  const [allBooks, courses] = await Promise.all([listBookRows(), listCourses()]);
  const byId = new Map(courses.map((course) => [course.id, course]));
  return allBooks.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    note: book.note ?? "",
    courseIds: book.courseIds,
    courses: book.courseIds
      .map((id) => byId.get(id))
      .filter((course): course is CourseRow => Boolean(course))
      .map(courseLabel),
  }));
}

export type BookRow = Awaited<ReturnType<typeof listBooks>>[number];

export async function getBook(id: string) {
  const book = await findBookById(id);
  if (!book) return null;
  const courses = await listCourses();
  const byId = new Map(courses.map((course) => [course.id, course]));
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    note: book.note ?? "",
    courseIds: book.courseIds,
    linked: book.courseIds
      .map((courseId) => byId.get(courseId))
      .filter((course): course is CourseRow => Boolean(course))
      .map((course) => ({ id: course.id, label: courseLabel(course) })),
    allCourses: courses.map((course) => ({
      id: course.id,
      label: courseLabel(course),
    })),
  };
}

export async function getCourse(id: string) {
  const course = await findCourseById(id);
  if (!course) return null;

  const [
    { boards: allBoards, levels: allLevels, subjects: allSubjects },
    materials,
    books,
  ] = await Promise.all([
    getCatalogLists(),
    listMaterialsForCourse(course.id),
    listBookRows(),
  ]);

  const board = allBoards.find((item) => item.id === course.boardId);
  const level = allLevels.find((item) => item.id === course.levelId);
  const subject = allSubjects.find((item) => item.id === course.subjectId);

  return {
    id: course.id,
    boardId: course.boardId,
    levelId: course.levelId,
    subjectId: course.subjectId,
    medium: course.medium ?? "",
    active: course.active,
    label: [board?.name, level?.name, subject?.name, course.medium]
      .filter(Boolean)
      .join(" / "),
    board: board ?? null,
    level: level ?? null,
    subject: subject ?? null,
    books: books
      .filter((book) => book.courseIds.includes(course.id))
      .map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author ?? "",
      })),
    materials: materials.map((material) => ({
      id: material.id,
      title: material.title,
      type: material.type,
      fileUrl: material.fileUrl,
    })),
  };
}

export async function getBoard(id: string) {
  const [boardRows, courses] = await Promise.all([
    db.select().from(boards).where(eq(boards.id, id)).limit(1),
    listCourses(),
  ]);
  const board = boardRows[0];
  if (!board) return null;
  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    active: board.active,
    courses: courses
      .filter((course) => course.boardId === board.id)
      .map((course) => ({
        id: course.id,
        label: courseLabel(course),
        active: course.active,
      })),
  };
}

export async function countPending() {
  return countOpenRequests();
}

/** Lives in `lib/queries/teacher.ts`; re-exported because the users page imports it here. */
export { getTeacherCourseAssignments } from "@/db/queries/teacher";
