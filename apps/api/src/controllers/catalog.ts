import type { Request } from "express";
import {
  boardSchema,
  bookSchema,
  courseSchema,
  levelSchema,
  materialSchema,
  recordIdSchema,
  subjectSchema,
  toggleSchema,
} from "@lms/shared";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { materials, users } from "@/db/schema";
import { isUniqueViolation, violatedConstraint } from "@/db/errors";
import { conflict, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import {
  createBoard,
  findBoardById,
  listActiveBoards,
  listBoards,
  setBoardActive,
  updateBoard,
} from "@/db/queries/boards";
import {
  createBook,
  findBookById,
  listBooks,
  updateBook,
} from "@/db/queries/books";
import {
  createCourse,
  findActiveCourseIds,
  findCourseById,
  listCourseRows,
  setCourseActive,
  updateCourse,
} from "@/db/queries/courses";
import {
  createLevel,
  findLevelById,
  listActiveLevels,
  listLevels,
  setLevelActive,
  updateLevel,
} from "@/db/queries/levels";
import {
  createMaterial,
  deleteMaterial,
  listMaterialsForCourse,
} from "@/db/queries/materials";
import {
  createSubject,
  findSubjectById,
  listActiveSubjects,
  listSubjects,
  setSubjectActive,
  updateSubject,
} from "@/db/queries/subjects";
import { getTeacherCourseAssignments } from "@/db/queries/teacher";
import { countBooksByCourse } from "@/db/queries/books";

/**
 * Catalog mutations and the admin catalog reads. Every mutation runs inside a
 * transaction together with its audit entry, exactly as the old actions did.
 */

function label(...parts: (string | undefined | null)[]) {
  return parts.filter(Boolean).join(" / ");
}

/** Constraint names are pinned per table so two unique indexes give two messages. */
function toPgMessage(error: unknown): never {
  if (isUniqueViolation(error)) {
    const constraint = violatedConstraint(error) ?? "";
    if (constraint.startsWith("levels_")) {
      throw conflict("That level name or order already exists.");
    }
    if (constraint === "courses_board_level_subject_medium_unique") {
      throw conflict(
        "That board, level, subject and medium combination already exists.",
      );
    }
    throw conflict(
      "That entry already exists. Change the name, slug or combination.",
    );
  }
  throw error;
}

async function runPg(
  req: Request,
  work: (
    actorId: string,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<void>,
) {
  const actorId = actorOf(req).id;
  await db.transaction(async (tx) => {
    try {
      await work(actorId, tx);
    } catch (error) {
      toPgMessage(error);
    }
  });
}

/* Boards */

export function createBoardRow(req: Request) {
  const input = boardSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    const board = await createBoard(input, tx);
    await writeAudit(
      {
        actorId,
        action: "createBoard",
        targetType: "Board",
        targetId: board.id,
        after: { name: board.name, slug: board.slug },
      },
      { tx },
    );
  });
}

export function updateBoardRow(req: Request) {
  const input = boardSchema.extend({ id: recordIdSchema }).parse({ ...req.body, id: req.params.id });
  return runPg(req, async (actorId, tx) => {
    const before = await findBoardById(input.id, tx);
    if (!before) throw notFound("Board not found");
    await updateBoard(input.id, input, tx);
    await writeAudit(
      {
        actorId,
        action: "updateBoard",
        targetType: "Board",
        targetId: input.id,
        before: { name: before.name, slug: before.slug, active: before.active },
        after: { name: input.name, slug: input.slug, active: input.active },
      },
      { tx },
    );
  });
}

export function toggleBoardRow(req: Request) {
  const input = toggleSchema.parse({
    id: req.params.id,
    active: req.body?.active,
  });
  return runPg(req, async (actorId, tx) => {
    await setBoardActive(input.id, input.active, tx);
    await writeAudit(
      {
        actorId,
        action: "toggleBoard",
        targetType: "Board",
        targetId: input.id,
        after: { active: input.active },
      },
      { tx },
    );
  });
}

/* Levels */

export function createLevelRow(req: Request) {
  const input = levelSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    const level = await createLevel(input, tx);
    await writeAudit(
      {
        actorId,
        action: "createLevel",
        targetType: "Level",
        targetId: level.id,
        after: { name: level.name, order: level.order },
      },
      { tx },
    );
  });
}

export function updateLevelRow(req: Request) {
  const input = levelSchema.extend({ id: recordIdSchema }).parse({ ...req.body, id: req.params.id });
  return runPg(req, async (actorId, tx) => {
    const before = await findLevelById(input.id, tx);
    if (!before) throw notFound("Level not found");
    await updateLevel(input.id, input, tx);
    await writeAudit(
      {
        actorId,
        action: "updateLevel",
        targetType: "Level",
        targetId: input.id,
        before: {
          name: before.name,
          order: before.order,
          active: before.active,
        },
        after: { name: input.name, order: input.order, active: input.active },
      },
      { tx },
    );
  });
}

export function toggleLevelRow(req: Request) {
  const input = toggleSchema.parse({
    id: req.params.id,
    active: req.body?.active,
  });
  return runPg(req, async (actorId, tx) => {
    await setLevelActive(input.id, input.active, tx);
    await writeAudit(
      {
        actorId,
        action: "toggleLevel",
        targetType: "Level",
        targetId: input.id,
        after: { active: input.active },
      },
      { tx },
    );
  });
}

/* Subjects */

export function createSubjectRow(req: Request) {
  const input = subjectSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    const subject = await createSubject(input, tx);
    await writeAudit(
      {
        actorId,
        action: "createSubject",
        targetType: "Subject",
        targetId: subject.id,
        after: { name: subject.name, slug: subject.slug },
      },
      { tx },
    );
  });
}

export function updateSubjectRow(req: Request) {
  const input = subjectSchema.extend({ id: recordIdSchema }).parse({ ...req.body, id: req.params.id });
  return runPg(req, async (actorId, tx) => {
    const before = await findSubjectById(input.id, tx);
    if (!before) throw notFound("Subject not found");
    await updateSubject(input.id, input, tx);
    await writeAudit(
      {
        actorId,
        action: "updateSubject",
        targetType: "Subject",
        targetId: input.id,
        before: { name: before.name, slug: before.slug, active: before.active },
        after: { name: input.name, slug: input.slug, active: input.active },
      },
      { tx },
    );
  });
}

export function toggleSubjectRow(req: Request) {
  const input = toggleSchema.parse({
    id: req.params.id,
    active: req.body?.active,
  });
  return runPg(req, async (actorId, tx) => {
    await setSubjectActive(input.id, input.active, tx);
    await writeAudit(
      {
        actorId,
        action: "toggleSubject",
        targetType: "Subject",
        targetId: input.id,
        after: { active: input.active },
      },
      { tx },
    );
  });
}

/* Courses */

/** Board, level and subject are checked against Postgres inside the write's transaction. */
async function assertActiveCatalog(
  course: { boardId: string; levelId: string; subjectId: string },
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const [board, level, subject] = await Promise.all([
    findBoardById(course.boardId, tx),
    findLevelById(course.levelId, tx),
    findSubjectById(course.subjectId, tx),
  ]);
  if (!board?.active || !level?.active || !subject?.active) {
    throw conflict("Choose an active board, level, and subject");
  }
}

export function createCourseRow(req: Request) {
  const input = courseSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    await assertActiveCatalog(input, tx);
    const course = await createCourse(input, tx);
    await writeAudit(
      {
        actorId,
        action: "createCourse",
        targetType: "Course",
        targetId: course.id,
        after: {
          boardId: input.boardId,
          levelId: input.levelId,
          subjectId: input.subjectId,
          medium: input.medium,
        },
      },
      { tx },
    );
  });
}

export function updateCourseRow(req: Request) {
  const input = courseSchema.extend({ id: recordIdSchema }).parse({ ...req.body, id: req.params.id });
  return runPg(req, async (actorId, tx) => {
    await assertActiveCatalog(input, tx);
    const before = await findCourseById(input.id, tx);
    if (!before) throw notFound("Course not found");
    await updateCourse(input.id, input, tx);
    await writeAudit(
      {
        actorId,
        action: "updateCourse",
        targetType: "Course",
        targetId: input.id,
        before: {
          boardId: before.boardId,
          levelId: before.levelId,
          subjectId: before.subjectId,
          medium: before.medium,
          active: before.active,
        },
        after: input,
      },
      { tx },
    );
  });
}

export function toggleCourseRow(req: Request) {
  const input = toggleSchema.parse({
    id: req.params.id,
    active: req.body?.active,
  });
  return runPg(req, async (actorId, tx) => {
    await setCourseActive(input.id, input.active, tx);
    await writeAudit(
      {
        actorId,
        action: "toggleCourse",
        targetType: "Course",
        targetId: input.id,
        after: { active: input.active },
      },
      { tx },
    );
  });
}

/* Books */

export function createBookRow(req: Request) {
  const input = bookSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    const active = await findActiveCourseIds(input.courseIds, tx);
    if (active.length !== new Set(input.courseIds).size) {
      throw conflict("One or more courses are missing or inactive");
    }
    const book = await createBook(input, tx);
    await writeAudit(
      {
        actorId,
        action: "createBook",
        targetType: "Book",
        targetId: book.id,
        after: {
          title: book.title,
          author: book.author,
          courseIds: book.courseIds,
        },
      },
      { tx },
    );
  });
}

export function updateBookRow(req: Request) {
  const input = bookSchema.extend({ id: recordIdSchema }).parse({ ...req.body, id: req.params.id });
  return runPg(req, async (actorId, tx) => {
    const active = await findActiveCourseIds(input.courseIds, tx);
    if (active.length !== new Set(input.courseIds).size) {
      throw conflict("One or more courses are missing or inactive");
    }
    const before = await findBookById(input.id, tx);
    if (!before) throw notFound("Book not found");
    await updateBook(input.id, input, tx);
    await writeAudit(
      {
        actorId,
        action: "updateBook",
        targetType: "Book",
        targetId: input.id,
        before: { title: before.title, courseIds: before.courseIds },
        after: { title: input.title, courseIds: input.courseIds },
      },
      { tx },
    );
  });
}

/* Materials */

export function createMaterialRow(req: Request) {
  const input = materialSchema.parse(req.body);
  return runPg(req, async (actorId, tx) => {
    const course = await findCourseById(input.courseId, tx);
    if (!course) throw notFound("Course not found");
    const material = await createMaterial(
      { ...input, uploadedBy: actorId },
      tx,
    );
    await writeAudit(
      {
        actorId,
        action: "createMaterial",
        targetType: "Material",
        targetId: material.id,
        after: {
          title: input.title,
          type: input.type,
          courseId: input.courseId,
        },
      },
      { tx },
    );
  });
}

export function deleteMaterialRow(req: Request) {
  return runPg(req, async (actorId, tx) => {
    const id = String(req.params.id);
    await deleteMaterial(id, tx);
    await writeAudit(
      {
        actorId,
        action: "deleteMaterial",
        targetType: "Material",
        targetId: id,
      },
      { tx },
    );
  });
}

/* Admin reads */

export async function listCatalog() {
  const [boards, levels, subjects] = await Promise.all([
    listBoards(),
    listLevels(),
    listSubjects(),
  ]);
  return { boards, levels, subjects };
}

export async function listCoursesView() {
  const [{ boards, levels, subjects }, rows, bookCounts] = await Promise.all([
    listCatalog(),
    listCourseRows(),
    countBooksByCourse(),
  ]);
  const boardName = new Map(boards.map((b) => [b.id, b.name]));
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  return rows.map((course) => {
    const level = levelById.get(course.levelId);
    const row = {
      id: course.id,
      boardId: course.boardId,
      board: boardName.get(course.boardId) ?? "-",
      levelId: course.levelId,
      level: level?.name ?? "-",
      levelOrder: level?.order ?? 999,
      subjectId: course.subjectId,
      subject: subjectName.get(course.subjectId) ?? "-",
      medium: course.medium ?? "",
      active: course.active,
      books: bookCounts.get(course.id) ?? 0,
    };
    return {
      ...row,
      label: label(row.board, row.level, row.subject, row.medium),
    };
  });
}

export function courseOptions() {
  return getTeacherCourseAssignments();
}

export async function getCourseDetail(req: Request) {
  const course = await findCourseById(String(req.params.id));
  if (!course) throw notFound("Course not found");
  const [{ boards, levels, subjects }, materials, books] = await Promise.all([
    listCatalog(),
    listMaterialsForCourse(course.id),
    listBooks(),
  ]);
  const board = boards.find((b) => b.id === course.boardId);
  const level = levels.find((l) => l.id === course.levelId);
  const subject = subjects.find((s) => s.id === course.subjectId);
  return {
    id: course.id,
    boardId: course.boardId,
    levelId: course.levelId,
    subjectId: course.subjectId,
    medium: course.medium ?? "",
    active: course.active,
    label: label(board?.name, level?.name, subject?.name, course.medium),
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
    materials: materials.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      fileUrl: m.fileUrl,
    })),
  };
}

export async function getBoardDetail(req: Request) {
  const board = await findBoardById(String(req.params.id));
  if (!board) throw notFound("Board not found");
  const courses = await listCoursesView();
  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    active: board.active,
    courses: courses
      .filter((course) => course.boardId === board.id)
      .map((course) => ({
        id: course.id,
        label: course.label,
        active: course.active,
      })),
  };
}

/** `GET /api/v1/admin/materials` — every material with its course label. */
export async function listMaterialsAdmin() {
  const [rows, courses] = await Promise.all([
    db
      .select({
        id: materials.id,
        title: materials.title,
        type: materials.type,
        courseId: materials.courseId,
        uploadedBy: users.name,
      })
      .from(materials)
      .innerJoin(users, eq(users.id, materials.uploadedBy))
      .orderBy(desc(materials.createdAt)),
    getTeacherCourseAssignments(),
  ]);
  const label = new Map(courses.map((course) => [course.id, course.label]));
  return rows.map((row) => ({ ...row, courseLabel: label.get(row.courseId) ?? "Course" }));
}

/** Active boards, levels and subjects: the public request form's options. */
export async function formOptions() {
  const [boards, levels, subjects] = await Promise.all([
    listActiveBoards(),
    listActiveLevels(),
    listActiveSubjects(),
  ]);
  const option = (row: { id: string; name: string }) => ({
    id: row.id,
    label: row.name,
  });
  return {
    boards: boards.map(option),
    levels: levels.map(option),
    subjects: subjects.map(option),
  };
}
