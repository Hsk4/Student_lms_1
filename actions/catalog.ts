'use server';

import { revalidatePath } from 'next/cache';
import type { ClientSession } from 'mongoose';
import { connectDB, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { Board } from '@/models/board';
import { Level } from '@/models/level';
import { Subject } from '@/models/subject';
import { Course } from '@/models/course';
import { Book } from '@/models/book';
import { Material } from '@/models/material';
import { writeAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/guards';
import {
  boardSchema,
  bookSchema,
  courseSchema,
  idSchema,
  levelSchema,
  materialSchema,
  subjectSchema,
  toggleSchema,
} from '@/lib/validators/catalog';
import { toState, type ActionState } from '@/lib/actions';

function toMessage(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  ) {
    throw new Error('That entry already exists. Change the name, slug or combination.');
  }
  throw error;
}

/** Every catalog mutation is audited. Nothing here is reachable without an admin session. */
async function run(
  paths: string[],
  work: (actorId: string) => Promise<void>
): Promise<ActionState> {
  try {
    const session = await requireRole(['super_admin', 'admin']);
    await connectDB();
    try {
      await work(session.actorId);
    } catch (error) {
      toMessage(error);
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
  return run(['/admin/boards', '/request'], async (actorId) => {
    const board = await Board.create({ ...input, slug: input.slug.toLowerCase() });
    await writeAudit({
      actorId,
      action: 'createBoard',
      targetType: 'Board',
      targetId: board._id,
      after: { name: board.name, slug: board.slug },
    });
  });
}

export async function updateBoard(raw: unknown) {
  const input = boardSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return run(['/admin/boards', `/admin/boards/${input.id}`], async (actorId) => {
    const before = await Board.findById(input.id).lean();
    if (!before) throw new Error('Board not found');

    await Board.updateOne(
      { _id: input.id },
      { name: input.name, slug: input.slug.toLowerCase(), active: input.active }
    );
    await writeAudit({
      actorId,
      action: 'updateBoard',
      targetType: 'Board',
      targetId: input.id,
      before: { name: before.name, slug: before.slug, active: before.active },
      after: { name: input.name, slug: input.slug, active: input.active },
    });
  });
}

export async function toggleBoard(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return run(['/admin/boards', '/request'], async (actorId) => {
    await Board.updateOne({ _id: input.id }, { active: input.active });
    await writeAudit({
      actorId,
      action: 'toggleBoard',
      targetType: 'Board',
      targetId: input.id,
      after: { active: input.active },
    });
  });
}

/* Levels */

export async function createLevel(raw: unknown) {
  const input = levelSchema.parse(raw);
  return run(['/admin/courses', '/request'], async (actorId) => {
    const level = await Level.create(input);
    await writeAudit({
      actorId,
      action: 'createLevel',
      targetType: 'Level',
      targetId: level._id,
      after: { name: level.name, order: level.order },
    });
  });
}

export async function updateLevel(raw: unknown) {
  const input = levelSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return run(['/admin/courses'], async (actorId) => {
    const before = await Level.findById(input.id).lean();
    if (!before) throw new Error('Level not found');

    await Level.updateOne(
      { _id: input.id },
      { name: input.name, order: input.order, active: input.active }
    );
    await writeAudit({
      actorId,
      action: 'updateLevel',
      targetType: 'Level',
      targetId: input.id,
      before: { name: before.name, order: before.order, active: before.active },
      after: { name: input.name, order: input.order, active: input.active },
    });
  });
}

export async function toggleLevel(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return run(['/admin/courses'], async (actorId) => {
    await Level.updateOne({ _id: input.id }, { active: input.active });
    await writeAudit({
      actorId,
      action: 'toggleLevel',
      targetType: 'Level',
      targetId: input.id,
      after: { active: input.active },
    });
  });
}

/* Subjects */

export async function createSubject(raw: unknown) {
  const input = subjectSchema.parse(raw);
  return run(['/admin/courses', '/request'], async (actorId) => {
    const subject = await Subject.create({ ...input, slug: input.slug.toLowerCase() });
    await writeAudit({
      actorId,
      action: 'createSubject',
      targetType: 'Subject',
      targetId: subject._id,
      after: { name: subject.name, slug: subject.slug },
    });
  });
}

export async function updateSubject(raw: unknown) {
  const input = subjectSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return run(['/admin/courses'], async (actorId) => {
    const before = await Subject.findById(input.id).lean();
    if (!before) throw new Error('Subject not found');

    await Subject.updateOne(
      { _id: input.id },
      { name: input.name, slug: input.slug.toLowerCase(), active: input.active }
    );
    await writeAudit({
      actorId,
      action: 'updateSubject',
      targetType: 'Subject',
      targetId: input.id,
      before: { name: before.name, slug: before.slug, active: before.active },
      after: { name: input.name, slug: input.slug, active: input.active },
    });
  });
}

export async function toggleSubject(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return run(['/admin/courses'], async (actorId) => {
    await Subject.updateOne({ _id: input.id }, { active: input.active });
    await writeAudit({
      actorId,
      action: 'toggleSubject',
      targetType: 'Subject',
      targetId: input.id,
      after: { active: input.active },
    });
  });
}

/* Courses */

export async function createCourse(raw: unknown) {
  const input = courseSchema.parse(raw);
  return run(['/admin/courses'], async (actorId) => {
    const [board, level, subject] = await Promise.all([
      Board.findOne({ _id: input.boardId, active: true }).lean(),
      Level.findOne({ _id: input.levelId, active: true }).lean(),
      Subject.findOne({ _id: input.subjectId, active: true }).lean(),
    ]);
    if (!board || !level || !subject) throw new Error('Choose an active board, level, and subject');
    const course = await Course.create(input);
    await writeAudit({
      actorId,
      action: 'createCourse',
      targetType: 'Course',
      targetId: course._id,
      after: {
        boardId: input.boardId,
        levelId: input.levelId,
        subjectId: input.subjectId,
        medium: input.medium,
      },
    });
  });
}

export async function updateCourse(raw: unknown) {
  const input = courseSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return run(['/admin/courses', `/admin/courses/${input.id}`], async (actorId) => {
    const [board, level, subject] = await Promise.all([
      Board.findOne({ _id: input.boardId, active: true }).lean(),
      Level.findOne({ _id: input.levelId, active: true }).lean(),
      Subject.findOne({ _id: input.subjectId, active: true }).lean(),
    ]);
    if (!board || !level || !subject) throw new Error('Choose an active board, level, and subject');
    const before = await Course.findById(input.id).lean();
    if (!before) throw new Error('Course not found');

    await Course.updateOne(
      { _id: input.id },
      {
        boardId: input.boardId,
        levelId: input.levelId,
        subjectId: input.subjectId,
        medium: input.medium,
        active: input.active,
      }
    );
    await writeAudit({
      actorId,
      action: 'updateCourse',
      targetType: 'Course',
      targetId: input.id,
      before: {
        boardId: String(before.boardId),
        levelId: String(before.levelId),
        subjectId: String(before.subjectId),
        medium: before.medium,
        active: before.active,
      },
      after: input,
    });
  });
}

export async function toggleCourse(id: string, active: boolean) {
  const input = toggleSchema.parse({ id, active });
  return run(['/admin/courses', `/admin/courses/${input.id}`], async (actorId) => {
    await Course.updateOne({ _id: input.id }, { active: input.active });
    await writeAudit({
      actorId,
      action: 'toggleCourse',
      targetType: 'Course',
      targetId: input.id,
      after: { active: input.active },
    });
  });
}

/* Books */

export async function createBook(raw: unknown) {
  const input = bookSchema.parse(raw);
  return run(['/admin/books'], async (actorId) => {
    const activeCourses = await Course.find({ _id: { $in: input.courseIds }, active: true }).select('_id').lean();
    if (activeCourses.length !== input.courseIds.length) throw new Error('One or more courses are missing or inactive');
    const book = await Book.create(input);
    await writeAudit({
      actorId,
      action: 'createBook',
      targetType: 'Book',
      targetId: book._id,
      after: { title: book.title, author: book.author, courseIds: input.courseIds },
    });
  });
}

export async function updateBook(raw: unknown) {
  const input = bookSchema.extend({ id: idSchema.shape.id }).parse(raw);
  return run(['/admin/books', `/admin/books/${input.id}`], async (actorId) => {
    const activeCourses = await Course.find({ _id: { $in: input.courseIds }, active: true }).select('_id').lean();
    if (activeCourses.length !== input.courseIds.length) throw new Error('One or more courses are missing or inactive');
    const before = await Book.findById(input.id).lean();
    if (!before) throw new Error('Book not found');

    await Book.updateOne(
      { _id: input.id },
      { title: input.title, author: input.author, courseIds: input.courseIds, note: input.note }
    );
    await writeAudit({
      actorId,
      action: 'updateBook',
      targetType: 'Book',
      targetId: input.id,
      before: { title: before.title, courseIds: (before.courseIds ?? []).map(String) },
      after: { title: input.title, courseIds: input.courseIds },
    });
  });
}

/* Materials: model and create action for Phase 2; the upload UI arrives in Phase 7. */

export async function createMaterial(raw: unknown) {
  const input = materialSchema.parse(raw);
  const current = await getCurrentUser();
  if (!current) return { ok: false, message: 'Sign in first' } satisfies ActionState;
  return run([`/admin/courses/${input.courseId}`], async (actorId) => {
    await withTransaction(async (dbSession: ClientSession) => {
      const course = await Course.findById(input.courseId).session(dbSession);
      if (!course) throw new Error('Course not found');

      const [material] = await Material.create(
        [
          {
            courseId: input.courseId,
            title: input.title,
            type: input.type,
            fileUrl: input.fileUrl,
            uploadedBy: actorId,
          },
        ],
        { session: dbSession }
      );

      await writeAudit(
        {
          actorId,
          action: 'createMaterial',
          targetType: 'Material',
          targetId: material._id,
          after: { title: input.title, type: input.type, courseId: input.courseId },
        },
        dbSession
      );
    });
  });
}
