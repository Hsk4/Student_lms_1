import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { classes, courses } from "@/db/schema";
import {
  listCourseIdsForTeacher,
  listCourseLabels,
  listTeachersForCourses,
} from "@/lib/queries/teacher-courses";
import { findUserById } from "@/lib/queries/users";
import type { ClassState, Id } from "@/lib/types";

/**
 * Teaching views: classes, matching teachers, course choices. Postgres-backed.
 *
 * `classes` is a real table with a teacher and a course column, so the
 * teacher's classes are one indexed read; the course labels come from a single
 * joined query rather than three separate catalog fetches.
 */

/** Teachers matching a student's board and level through their assigned courses. */
export async function listMatchingTeachers(
  studentId: Id,
  conn: Tx | typeof db = db,
) {
  const student = await findUserById(studentId, conn);
  if (!student || student.role !== "student") return [];
  const { boardId, levelId } = student.student;
  if (!boardId || !levelId) return [];

  // Only courses on the student's own board and level can match, which is the
  // filter the Mongo query expressed as a `find` on two fields.
  const matching = await conn
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.active, true),
        eq(courses.boardId, boardId),
        eq(courses.levelId, levelId),
      ),
    );
  if (matching.length === 0) return [];

  const courseIds = matching.map((row) => row.id);
  const [labels, teachers] = await Promise.all([
    listCourseLabels({ courseIds }, conn),
    listTeachersForCourses(courseIds, conn),
  ]);
  const labelById = new Map(labels.map((course) => [course.id, course.label]));

  return teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    courses: teacher.courseIds
      .filter((id) => labelById.has(id))
      .map((id) => ({ id, label: labelById.get(id) ?? "Course" })),
  }));
}

export type MatchingTeacher = Awaited<
  ReturnType<typeof listMatchingTeachers>
>[number];

export async function listTeacherClasses(
  teacherId: Id,
  conn: Tx | typeof db = db,
) {
  const rows = await conn
    .select()
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(desc(classes.createdAt));

  const labels = await listCourseLabels(
    { courseIds: [...new Set(rows.map((row) => row.courseId))] },
    conn,
  );
  const labelById = new Map(labels.map((label) => [label.id, label.label]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    courseId: row.courseId,
    courseLabel: labelById.get(row.courseId) ?? "Course",
    schedule: row.schedule ?? "",
    state: row.state,
  }));
}

export async function listCourseChoicesForTeacher(
  teacherId: Id,
  conn: Tx | typeof db = db,
) {
  const courseIds = await listCourseIdsForTeacher(teacherId, conn);
  if (courseIds.length === 0) return [];
  const labels = await listCourseLabels({ courseIds }, conn);
  return labels.map((label) => ({ id: label.id, label: label.label }));
}

export async function createClass(
  input: {
    teacherId: Id;
    courseId: Id;
    name: string;
    schedule?: string | null;
    state?: ClassState;
    startsOn?: Date | null;
    endsOn?: Date | null;
  },
  conn: Tx | typeof db = db,
) {
  const [row] = await conn
    .insert(classes)
    .values({
      teacherId: input.teacherId,
      courseId: input.courseId,
      name: input.name,
      schedule: input.schedule ?? null,
      state: input.state ?? "current",
      startsOn: input.startsOn ?? null,
      endsOn: input.endsOn ?? null,
    })
    .returning();
  return row;
}

export async function findClassById(id: Id, conn: Tx | typeof db = db) {
  const [row] = await conn
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);
  return row ?? null;
}
