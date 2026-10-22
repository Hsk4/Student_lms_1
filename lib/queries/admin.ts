import "server-only";
import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { User, type UserRole } from "@/models/user";
import { AccessRequest } from "@/models/access-request";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";
import { Course } from "@/models/course";
import { Book } from "@/models/book";
import { Material } from "@/models/material";
import { AuditLog } from "@/models/audit-log";

const shortId = (value: unknown) => String(value);

export async function listPendingUsers() {
  await connectDB();
  return User.find({ status: "pending" }).sort({ createdAt: -1 }).limit(200).lean();
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

export async function listAccessRequests(state: "open" | "approved" | "rejected"): Promise<RequestRow[]> {
  // Date arithmetic below is request-time data, so never prerender this page.
  await connection();
  await connectDB();
  const requests = await AccessRequest.find({ state }).sort({ createdAt: -1 }).limit(200).lean();
  if (!requests.length) return [];

  const userIds = requests.map((request) => request.userId);
  const [users, boards, levels, subjects] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("status role").lean(),
    Board.find().lean(),
    Level.find().lean(),
    Subject.find().lean(),
  ]);
  const usersById = new Map(users.map((user) => [shortId(user._id), user]));
  const boardNames = new Map(boards.map((item) => [shortId(item._id), item.name]));
  const levelNames = new Map(levels.map((item) => [shortId(item._id), item.name]));
  const subjectNames = new Map(subjects.map((item) => [shortId(item._id), item.name]));

  return requests.map((request) => {
    const user = usersById.get(shortId(request.userId));
    return {
      id: shortId(request._id),
      userId: shortId(request.userId),
      name: request.name,
      email: request.email,
      note: request.note,
      state: request.state,
      createdAt: new Date(request.createdAt).toISOString(),
      board: request.boardId ? boardNames.get(shortId(request.boardId)) : undefined,
      level: request.levelId ? levelNames.get(shortId(request.levelId)) : undefined,
      subjects: (request.subjectIds ?? []).map((id: { toString(): string }) => subjectNames.get(shortId(id)) ?? "-").join(", "),
      userStatus: user?.status ?? "unknown",
      userRole: user?.role ?? null,
      requestedRole: request.requestedRole ?? null,
    };
  });
}

export async function listUsers(filter?: { status?: string; role?: string; q?: string }) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter?.status) query.status = filter.status;
  if (filter?.role) query.role = filter.role;
  if (filter?.q) {
    const escaped = filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ name: new RegExp(escaped, "i") }, { email: new RegExp(escaped, "i") }];
  }

  const users = await User.find(query).sort({ createdAt: -1 }).limit(200).lean();
  const boardIds = users.map((user) => user.student?.boardId).filter(Boolean);
  const levelIds = users.map((user) => user.student?.levelId).filter(Boolean);
  const [boards, levels] = await Promise.all([
    Board.find({ _id: { $in: boardIds } }).lean(),
    Level.find({ _id: { $in: levelIds } }).lean(),
  ]);
  const boardNames = new Map(boards.map((item) => [shortId(item._id), item.name]));
  const levelNames = new Map(levels.map((item) => [shortId(item._id), item.name]));

  return users.map((user) => ({
    id: shortId(user._id),
    name: user.name,
    email: user.email,
    role: (user.role ?? null) as UserRole | null,
    status: String(user.status),
    onboarded: Boolean(user.onboarded),
    createdAt: new Date(user.createdAt).toISOString(),
    board: user.student?.boardId ? boardNames.get(shortId(user.student.boardId)) : undefined,
    level: user.student?.levelId ? levelNames.get(shortId(user.student.levelId)) : undefined,
    rejectionReason: user.rejectionReason,
  }));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export async function getTeacherCourseAssignments() {
  await connectDB();
  const [courses, teachers, boards, levels, subjects] = await Promise.all([
    Course.find({ active: true }).lean(),
    User.find({ role: "teacher", status: "active" }).select("teacher.courseIds").lean(),
    Board.find().select("name").lean(),
    Level.find().select("name").lean(),
    Subject.find().select("name").lean(),
  ]);
  const boardNames = new Map(boards.map((item) => [shortId(item._id), item.name]));
  const levelNames = new Map(levels.map((item) => [shortId(item._id), item.name]));
  const subjectNames = new Map(subjects.map((item) => [shortId(item._id), item.name]));
  const teachersByCourse = new Map<string, string[]>();
  for (const teacher of teachers) {
    for (const courseId of teacher.teacher?.courseIds ?? []) {
      const id = shortId(courseId);
      teachersByCourse.set(id, [...(teachersByCourse.get(id) ?? []), shortId(teacher._id)]);
    }
  }

  return courses.map((course) => {
    const id = shortId(course._id);
    const board = boardNames.get(shortId(course.boardId)) ?? "Board";
    const level = levelNames.get(shortId(course.levelId)) ?? "Level";
    const subject = subjectNames.get(shortId(course.subjectId)) ?? "Subject";
    const medium = course.medium ? ` - ${course.medium}` : "";
    return { id, label: `${board} - ${level} - ${subject}${medium}`, teacherIds: teachersByCourse.get(id) ?? [] };
  });
}

export async function listAuditLog() {
  await connectDB();
  const entries = await AuditLog.find().sort({ at: -1 }).limit(200).lean();
  const actorIds = [...new Set(entries.map((entry) => shortId(entry.actorId)))];
  const actors = await User.find({ _id: { $in: actorIds } }).select("name email").lean();
  const actorsById = new Map(actors.map((actor) => [shortId(actor._id), { name: actor.name, email: actor.email }]));
  return entries.map((entry) => ({
    id: shortId(entry._id),
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ? shortId(entry.targetId) : null,
    actor: actorsById.get(shortId(entry.actorId)),
    before: (entry.before ?? null) as Record<string, unknown> | null,
    after: (entry.after ?? null) as Record<string, unknown> | null,
    at: new Date(entry.at).toISOString(),
  }));
}

export type CatalogLists = {
  boards: { id: string; name: string; slug: string; active: boolean }[];
  levels: { id: string; name: string; order: number; active: boolean }[];
  subjects: { id: string; name: string; slug: string; active: boolean }[];
};

export async function getCatalogLists(): Promise<CatalogLists> {
  await connectDB();
  const [boards, levels, subjects] = await Promise.all([
    Board.find().sort({ name: 1 }).lean(),
    Level.find().sort({ order: 1 }).lean(),
    Subject.find().sort({ name: 1 }).lean(),
  ]);
  return {
    boards: boards.map((item) => ({ id: shortId(item._id), name: item.name, slug: item.slug, active: item.active })),
    levels: levels.map((item) => ({ id: shortId(item._id), name: item.name, order: item.order, active: item.active })),
    subjects: subjects.map((item) => ({ id: shortId(item._id), name: item.name, slug: item.slug, active: item.active })),
  };
}

export type CourseRow = {
  id: string; boardId: string; board: string; levelId: string; level: string;
  levelOrder: number; subjectId: string; subject: string; medium: string; active: boolean; books: number;
};

export async function listCourses(): Promise<CourseRow[]> {
  const { boards, levels, subjects } = await getCatalogLists();
  await connectDB();
  const [courses, books] = await Promise.all([
    Course.find().sort({ createdAt: -1 }).limit(500).lean(),
    Book.find().select("courseIds").lean(),
  ]);
  const boardNames = new Map(boards.map((item) => [item.id, item.name]));
  const levelsById = new Map(levels.map((item) => [item.id, item]));
  const subjectNames = new Map(subjects.map((item) => [item.id, item.name]));
  const bookCounts = new Map<string, number>();
  for (const book of books) {
    for (const courseId of book.courseIds ?? []) {
      const id = shortId(courseId);
      bookCounts.set(id, (bookCounts.get(id) ?? 0) + 1);
    }
  }
  return courses.map((course) => {
    const level = levelsById.get(shortId(course.levelId));
    return {
      id: shortId(course._id), boardId: shortId(course.boardId),
      board: boardNames.get(shortId(course.boardId)) ?? "-",
      levelId: shortId(course.levelId), level: level?.name ?? "-", levelOrder: level?.order ?? 999,
      subjectId: shortId(course.subjectId), subject: subjectNames.get(shortId(course.subjectId)) ?? "-",
      medium: course.medium ?? "", active: course.active, books: bookCounts.get(shortId(course._id)) ?? 0,
    };
  });
}

export function courseLabel(course: CourseRow) {
  return `${course.board} / ${course.level} / ${course.subject}${course.medium ? ` / ${course.medium}` : ""}`;
}

export async function listBooks() {
  await connectDB();
  const books = await Book.find().sort({ title: 1 }).lean();
  const courses = await listCourses();
  const byId = new Map(courses.map((course) => [course.id, course]));
  return books.map((book) => ({
    id: shortId(book._id), title: book.title, author: book.author ?? "", note: book.note ?? "",
    courseIds: (book.courseIds ?? []).map(shortId),
    courses: (book.courseIds ?? []).map((id: { toString(): string }) => byId.get(shortId(id))).filter((course: CourseRow | undefined): course is CourseRow => Boolean(course)).map(courseLabel),
  }));
}

export type BookRow = Awaited<ReturnType<typeof listBooks>>[number];

export async function getBook(id: string) {
  await connectDB();
  const book = await Book.findById(id).lean();
  if (!book) return null;
  const courses = await listCourses();
  const byId = new Map(courses.map((course) => [course.id, course]));
  const courseIds = (book.courseIds ?? []).map(shortId);
  return {
    id: shortId(book._id), title: book.title, author: book.author ?? "", note: book.note ?? "", courseIds,
    linked: courseIds.map((courseId: string) => byId.get(courseId)).filter((course: CourseRow | undefined): course is CourseRow => Boolean(course)).map((course: CourseRow) => ({ id: course.id, label: courseLabel(course) })),
    allCourses: courses.map((course: CourseRow) => ({ id: course.id, label: courseLabel(course) })),
  };
}

export async function getCourse(id: string) {
  await connectDB();
  const course = await Course.findById(id).lean();
  if (!course) return null;
  const { boards, levels, subjects } = await getCatalogLists();
  const board = boards.find((item) => item.id === shortId(course.boardId));
  const level = levels.find((item) => item.id === shortId(course.levelId));
  const subject = subjects.find((item) => item.id === shortId(course.subjectId));
  const [materials, books] = await Promise.all([
    Material.find({ courseId: course._id }).sort({ createdAt: -1 }).lean(),
    Book.find({ courseIds: course._id }).lean(),
  ]);
  return {
    id: shortId(course._id), boardId: shortId(course.boardId), levelId: shortId(course.levelId), subjectId: shortId(course.subjectId),
    medium: course.medium ?? "", active: course.active,
    label: [board?.name, level?.name, subject?.name, course.medium].filter(Boolean).join(" / "),
    board: board ?? null, level: level ?? null, subject: subject ?? null,
    books: books.map((book) => ({ id: shortId(book._id), title: book.title, author: book.author ?? "" })),
    materials: materials.map((material) => ({ id: shortId(material._id), title: material.title, type: String(material.type), fileUrl: material.fileUrl })),
  };
}

export async function getBoard(id: string) {
  await connectDB();
  const board = await Board.findById(id).lean();
  if (!board) return null;
  const courses = await listCourses();
  return {
    id: shortId(board._id), name: board.name, slug: board.slug, active: board.active,
    courses: courses.filter((course) => course.boardId === shortId(board._id)).map((course) => ({ id: course.id, label: courseLabel(course), active: course.active })),
  };
}

export async function countPending() {
  await connectDB();
  return AccessRequest.countDocuments({ state: "open" });
}
