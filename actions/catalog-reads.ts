"use server";

import { connectDB } from "@/lib/db";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";
import { Course } from "@/models/course";
import { Book } from "@/models/book";
import { getCurrentUser } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/guards";
import { User } from "@/models/user";
import { objectIdSchema } from "@/lib/validators/common";

export type CatalogOption = { id: string; label: string };

export type CourseOption = {
  id: string;
  label: string;
  boardId: string;
  levelId: string;
  subjectId: string;
};

function label(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" / ");
}

/** Public form options: one board list, one level list, subjects, and nothing else. */
export async function getFormOptions() {
  const user = await getCurrentUser();
  if (!user) return { boards: [], levels: [], subjects: [] };

  await connectDB();

  const [boards, levels, subjects] = await Promise.all([
    Board.find({ active: true }).sort({ name: 1 }).lean(),
    Level.find({ active: true }).sort({ order: 1 }).lean(),
    Subject.find({ active: true }).sort({ name: 1 }).lean(),
  ]);

  return {
    boards: boards.map((b) => ({ id: String(b._id), label: b.name })),
    levels: levels.map((l) => ({ id: String(l._id), label: l.name })),
    subjects: subjects.map((s) => ({ id: String(s._id), label: s.name })),
  };
}

/** Active courses available to catalog managers. Student matching has its own guarded getter. */
export async function getCourseOptions(filter?: {
  boardId?: string;
  levelId?: string;
}) {
  await requireRole(["super_admin", "admin"]);
  await connectDB();

  const query: Record<string, unknown> = { active: true };
  if (filter?.boardId) query.boardId = objectIdSchema.parse(filter.boardId);
  if (filter?.levelId) query.levelId = objectIdSchema.parse(filter.levelId);

  const courses = await Course.find(query)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  const [boards, levels, subjects] = await Promise.all([
    Board.find().lean(),
    Level.find().lean(),
    Subject.find().lean(),
  ]);

  const boardName = new Map(boards.map((b) => [String(b._id), b.name]));
  const levelName = new Map(levels.map((l) => [String(l._id), l.name]));
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));

  return courses.map<CourseOption>((c) => {
    const boardId = String(c.boardId);
    const levelId = String(c.levelId);
    const subjectId = String(c.subjectId);
    return {
      id: String(c._id),
      boardId,
      levelId,
      subjectId,
      label: label(
        boardName.get(boardId),
        levelName.get(levelId),
        subjectName.get(subjectId),
        c.medium || undefined,
      ),
    };
  });
}

/** Active student courses are narrowed to the student's board and level. */
export async function getStudentCourseOptions() {
  const session = await requireRole(["student"]);
  await connectDB();
  const student = await User.findOne({ clerkId: session.clerkId })
    .select("student.boardId student.levelId")
    .lean();
  if (!student?.student?.boardId || !student.student.levelId) return [];

  const courses = await Course.find({
    boardId: student.student.boardId,
    levelId: student.student.levelId,
    active: true,
  }).sort({ subjectId: 1 }).lean();
  const subjects = await Subject.find({ _id: { $in: courses.map((course) => course.subjectId) } }).lean();
  const names = new Map(subjects.map((subject) => [String(subject._id), subject.name]));
  return courses.map((course) => ({
    id: String(course._id),
    label: `${names.get(String(course.subjectId)) ?? "Subject"}${course.medium ? ` / ${course.medium}` : ""}`,
  }));
}

export async function getBookOptions(courseIds: string[]) {
  const session = await requireRole(["student"]);
  await connectDB();
  const student = await User.findOne({ clerkId: session.clerkId }).select("student.boardId student.levelId").lean();
  const permittedCourses = student?.student?.boardId && student.student.levelId
    ? await Course.find({ boardId: student.student.boardId, levelId: student.student.levelId, active: true }).select("_id").lean()
    : [];
  const permittedCourseIds = permittedCourses.map((course) => String(course._id));
  const requestedIds = courseIds.map((id) => objectIdSchema.parse(id));
  if (requestedIds.some((id) => !permittedCourseIds.includes(id))) throw new Error("Course access denied");
  const books = await Book.find({ courseIds: { $in: requestedIds } }).sort({ title: 1 }).lean();
  return books.map((book) => ({
    id: String(book._id),
    label: book.author ? `${book.title} - ${book.author}` : book.title,
    courseIds: (book.courseIds ?? []).map(String),
  }));
}
