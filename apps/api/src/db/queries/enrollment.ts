import { and, desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import {
  boards,
  classes,
  courses,
  enrollments,
  levels,
  subjects,
  users,
} from "@/db/schema";
import type { Enrollment, EnrollmentState, Id } from "@/db/types";

/**
 * Enrollments. Postgres-backed.
 *
 * The old version issued six `find({ _id: { $in: [...] } })` calls and joined in
 * memory because Mongo cannot join. This is one query with the joins the indexes
 * were already built for.
 */

type EnrollmentRow = typeof enrollments.$inferSelect;

/** `users` is joined twice (student and teacher), so one side needs an alias. */
const teachers = alias(users, "teacher_user");

export function toEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    studentId: row.studentId,
    teacherId: row.teacherId,
    courseId: row.courseId,
    classId: row.classId,
    state: row.state,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    endReason: row.endReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type EnrollmentView = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  teacherId: string;
  teacherName: string;
  courseId: string;
  courseLabel: string;
  classId: string | null;
  className: string | null;
  state: string;
  requestedAt: string;
  decidedAt: string | null;
};

export async function findEnrollmentById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Enrollment | null> {
  const [row] = await conn
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, id))
    .limit(1);
  return row ? toEnrollment(row) : null;
}

/** The guard's lookup: does an active enrollment tie this teacher to this student? */
export async function findActiveEnrollmentBetween(
  teacherId: Id,
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<Enrollment | null> {
  const [row] = await conn
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.teacherId, teacherId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.state, "active"),
      ),
    )
    .limit(1);
  return row ? toEnrollment(row) : null;
}

export async function listEnrollments(
  filter?: { teacherId?: Id; studentId?: Id; state?: EnrollmentState },
  limit = 300,
): Promise<EnrollmentView[]> {
  const where = [
    filter?.teacherId ? eq(enrollments.teacherId, filter.teacherId) : undefined,
    filter?.studentId ? eq(enrollments.studentId, filter.studentId) : undefined,
    filter?.state ? eq(enrollments.state, filter.state) : undefined,
  ].filter((clause): clause is SQL => clause !== undefined);

  const rows = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      studentName: users.name,
      studentEmail: users.email,
      teacherId: enrollments.teacherId,
      teacherName: teachers.name,
      courseId: enrollments.courseId,
      classId: enrollments.classId,
      className: classes.name,
      state: enrollments.state,
      requestedAt: enrollments.requestedAt,
      decidedAt: enrollments.decidedAt,
      boardName: boards.name,
      levelName: levels.name,
      subjectName: subjects.name,
      medium: courses.medium,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .innerJoin(teachers, eq(teachers.id, enrollments.teacherId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(boards, eq(boards.id, courses.boardId))
    .innerJoin(levels, eq(levels.id, courses.levelId))
    .innerJoin(subjects, eq(subjects.id, courses.subjectId))
    .leftJoin(classes, eq(classes.id, enrollments.classId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(enrollments.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    courseId: row.courseId,
    courseLabel: `${row.boardName} / ${row.levelName} / ${row.subjectName}${
      row.medium ? ` / ${row.medium}` : ""
    }`,
    classId: row.classId,
    className: row.className,
    state: row.state,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  }));
}

export async function createEnrollment(
  input: {
    studentId: Id;
    teacherId: Id;
    courseId: Id;
    classId?: Id | null;
    state?: EnrollmentState;
  },
  conn: Tx | typeof db = db,
): Promise<Enrollment> {
  const [row] = await conn
    .insert(enrollments)
    .values({
      studentId: input.studentId,
      teacherId: input.teacherId,
      courseId: input.courseId,
      classId: input.classId ?? null,
      state: input.state ?? "requested",
    })
    .returning();
  return toEnrollment(row);
}

export async function updateEnrollment(
  id: Id,
  input: Partial<{
    teacherId: Id;
    classId: Id | null;
    state: EnrollmentState;
    decidedAt: Date | null;
    endReason: string | null;
  }>,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(enrollments).set(input).where(eq(enrollments.id, id));
}

export async function listEnrollmentsForTeacher(
  teacherId: Id,
  conn: Tx | typeof db = db,
): Promise<Enrollment[]> {
  const rows = await conn
    .select()
    .from(enrollments)
    .where(eq(enrollments.teacherId, teacherId))
    .orderBy(desc(enrollments.createdAt));
  return rows.map(toEnrollment);
}

export async function listActiveEnrollmentsForStudent(
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<Enrollment[]> {
  const rows = await conn
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.state, "active"),
      ),
    );
  return rows.map(toEnrollment);
}
