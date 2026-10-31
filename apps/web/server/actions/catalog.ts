"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { isUniqueViolation, violatedConstraint } from "@/db/errors";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  createBoard as insertBoard,
  findBoardById,
  setBoardActive,
  updateBoard as updateBoardRow,
} from "@/lib/queries/boards";
import {
  createBook as insertBook,
  findBookById,
  updateBook as updateBookRow,
} from "@/lib/queries/books";
import {
  createCourse as insertCourse,
  findActiveCourseIds,
  findCourseById,
  setCourseActive,
  updateCourse as updateCourseRow,
} from "@/lib/queries/courses";
import {
  createLevel as insertLevel,
  findLevelById,
  setLevelActive,
  updateLevel as updateLevelRow,
} from "@/lib/queries/levels";
import {
  createMaterial as insertMaterial,
  deleteMaterial as deleteMaterialRow,
} from "@/lib/queries/materials";
import {
  createSubject as insertSubject,
  findSubjectById,
  setSubjectActive,
  updateSubject as updateSubjectRow,
} from "@/lib/queries/subjects";
import {
  boardSchema,
  bookSchema,
  courseSchema,
  idSchema,
  levelSchema,
  materialSchema,
  subjectSchema,
  toggleSchema,
} from "@lms/shared";
import { toState, type ActionState } from "@/lib/actions";

/**
 * Every catalog mutation is audited. Nothing here is reachable without an admin
 * session, and every mutation plus its audit entry commits inside one
 * `db.transaction` â€” there is no Mongoose path left in this file.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Postgres duplicate keys arrive wrapped by Drizzle, so the real `PostgresError`
 * sits on `.cause` and must be read with `isUniqueViolation`. Constraint names
 * are pinned per table so two unique indexes can give two different messages.
 */
function toPgMessage(error: unknown): never {
  if (isUniqueViolation(error)) {
    const constraint = violatedConstraint(error) ?? "";
    if (constraint.startsWith("levels_")) {
      throw new Error("That level name or order already exists.");
    }
    if (constraint === "courses_board_level_subject_medium_unique") {
      throw new Error(
        "That board, level, subject and medium combination already exists.",
      );
    }
    throw new Error(
      "That entry already exists. Change the name, slug or combination.",
    );
  }
  throw error;
}

async function runPg(
  paths: string[],
  work: (actorId: string, tx: Tx) => Promise<void>,
): Promise<ActionState> {
  try {
    const session = await requireRole(["super_admin", "admin"]);
    try {
      await db.transaction(async (tx) => {
        await work(session.actorId, tx);
      });
    } catch (error) {
      toPgMessage(error);
    }
    for (const path of paths) revalidatePath(path);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/* Boards */

export async function createBoard(raw: unknown) {
  const input = boardSchema.parse(raw);
  return runPg(["/admin/boards", "/request"], async (actorId, tx) => {
    const board = await insertBoard(input, tx);
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

export async function updateBoard(raw: unknown) {
  const input = boardSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return runPg(
    ["/admin/boards", `/admin/boards/${input.id}`],
    async (actorId, tx) => {
      const before = await findBoardById(input.id, tx);
      if (!before) throw new Error("Board not found");

      await updateBoardRow(input.id, input, tx);
      await writeAudit(
        {
          actorId,
          action: "updateBoard",
          targetType: "Board",
          targetId: input.id,
          before: {
            name: before.name,
            slug: before.slug,
            active: before.active,
          },
          after: { name: input.name, slug: input.slug, active: input.active },
        },
        { tx },
      );
    },
  );
}

export async function toggleBoard(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return runPg(["/admin/boards", "/request"], async (actorId, tx) => {
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

export async function createLevel(raw: unknown) {
  const input = levelSchema.parse(raw);
  return runPg(["/admin/courses", "/request"], async (actorId, tx) => {
    const level = await insertLevel(input, tx);
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

export async function updateLevel(raw: unknown) {
  const input = levelSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return runPg(["/admin/courses"], async (actorId, tx) => {
    const before = await findLevelById(input.id, tx);
    if (!before) throw new Error("Level not found");

    await updateLevelRow(input.id, input, tx);
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

export async function toggleLevel(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return runPg(["/admin/courses"], async (actorId, tx) => {
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

export async function createSubject(raw: unknown) {
  const input = subjectSchema.parse(raw);
  return runPg(["/admin/courses", "/request"], async (actorId, tx) => {
    const subject = await insertSubject(input, tx);
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

export async function updateSubject(raw: unknown) {
  const input = subjectSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return runPg(["/admin/courses"], async (actorId, tx) => {
    const before = await findSubjectById(input.id, tx);
    if (!before) throw new Error("Subject not found");

    await updateSubjectRow(input.id, input, tx);
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

export async function toggleSubject(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return runPg(["/admin/courses"], async (actorId, tx) => {
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

/**
 * Board, level and subject are validated against **Postgres**, inside the same
 * transaction that writes the course. The previous version validated the subject
 * with Mongoose while subjects already lived in Postgres, so any subject created
 * through the admin UI was invisible here and course creation always failed.
 */
async function assertActiveCatalog(
  course: { boardId: string; levelId: string; subjectId: string },
  tx: Tx,
) {
  const [board, level, subject] = await Promise.all([
    findBoardById(course.boardId, tx),
    findLevelById(course.levelId, tx),
    findSubjectById(course.subjectId, tx),
  ]);
  if (!board?.active || !level?.active || !subject?.active) {
    throw new Error("Choose an active board, level, and subject");
  }
}

export async function createCourse(raw: unknown) {
  const input = courseSchema.parse(raw);
  return runPg(["/admin/courses"], async (actorId, tx) => {
    await assertActiveCatalog(input, tx);
    const course = await insertCourse(input, tx);
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

export async function updateCourse(raw: unknown) {
  const input = courseSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return runPg(
    ["/admin/courses", `/admin/courses/${input.id}`],
    async (actorId, tx) => {
      await assertActiveCatalog(input, tx);
      const before = await findCourseById(input.id, tx);
      if (!before) throw new Error("Course not found");

      await updateCourseRow(input.id, input, tx);
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
    },
  );
}

export async function toggleCourse(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return runPg(
    ["/admin/courses", `/admin/courses/${input.id}`],
    async (actorId, tx) => {
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
    },
  );
}

/* Books */

export async function createBook(raw: unknown) {
  const input = bookSchema.parse(raw);
  return runPg(["/admin/books"], async (actorId, tx) => {
    const activeCourses = await findActiveCourseIds(input.courseIds, tx);
    if (activeCourses.length !== new Set(input.courseIds).size) {
      throw new Error("One or more courses are missing or inactive");
    }
    const book = await insertBook(input, tx);
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

export async function updateBook(raw: unknown) {
  const input = bookSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return runPg(
    ["/admin/books", `/admin/books/${input.id}`],
    async (actorId, tx) => {
      const activeCourses = await findActiveCourseIds(input.courseIds, tx);
      if (activeCourses.length !== new Set(input.courseIds).size) {
        throw new Error("One or more courses are missing or inactive");
      }
      const before = await findBookById(input.id, tx);
      if (!before) throw new Error("Book not found");

      await updateBookRow(input.id, input, tx);
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
    },
  );
}

/* Materials */

export async function createMaterial(raw: unknown) {
  const input = materialSchema.parse(raw);
  return runPg([`/admin/courses/${input.courseId}`], async (actorId, tx) => {
    const course = await findCourseById(input.courseId, tx);
    if (!course) throw new Error("Course not found");

    const material = await insertMaterial(
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

export async function deleteMaterial(id: string) {
  const input = idSchema.parse({ id });
  return runPg(["/admin/courses"], async (actorId, tx) => {
    await deleteMaterialRow(input.id, tx);
    await writeAudit(
      {
        actorId,
        action: "deleteMaterial",
        targetType: "Material",
        targetId: input.id,
      },
      { tx },
    );
  });
}
