"use server";

import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assignments,
  attendanceRecords,
  attendanceSessions,
  boards,
  classes,
  courses,
  enrollments,
  levels,
  materials,
  submissions,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  listStudentAssignments,
  type StudentAssignmentRow,
} from "@/lib/queries/assessment";
import { listBooksForCourses } from "@/lib/queries/books";
import { listCourseLabels } from "@/lib/queries/teacher-courses";
import { findUserById, listUsersByIds } from "@/lib/queries/users";
import type { Id } from "@/lib/types";

/**
 * Student panel reads. Postgres-backed.
 *
 * Every getter used to fetch the catalog tables and join in memory because
 * Mongo cannot join. `listCourseLabels` now does that in one query, so the
 * shape below is unchanged while the data path is a single round trip.
 */

/** The signed-in student's own record. Every read below scopes to this id. */
async function requireStudentActor() {
  const session = await requireRole(["student"]);
  return { actorId: session.actorId as Id, session };
}

/** Course ids for the student, optionally only active enrollments. */
async function courseIdsOf(studentId: Id, onlyActive = false): Promise<Id[]> {
  const rows = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(
      onlyActive
        ? and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.state, "active"),
          )
        : eq(enrollments.studentId, studentId),
    );
  return [...new Set(rows.map((row) => row.courseId))];
}

export type StudentCourse = {
  enrollmentId: string;
  state: string;
  courseId: string;
  courseLabel: string;
  medium: string | null;
  teacherName: string;
  className: string | null;
  schedule: string | null;
  requestedAt: string;
  decidedAt: string | null;
};

export async function listMyCourses(): Promise<StudentCourse[]> {
  const { actorId } = await requireStudentActor();

  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      state: enrollments.state,
      courseId: enrollments.courseId,
      medium: courses.medium,
      teacherId: enrollments.teacherId,
      className: classes.name,
      schedule: classes.schedule,
      requestedAt: enrollments.requestedAt,
      decidedAt: enrollments.decidedAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(classes, eq(classes.id, enrollments.classId))
    .where(eq(enrollments.studentId, actorId))
    .orderBy(desc(enrollments.createdAt));
  if (rows.length === 0) return [];

  const [teachers, labels] = await Promise.all([
    listUsersByIds([...new Set(rows.map((row) => row.teacherId))]),
    listCourseLabels({
      courseIds: [...new Set(rows.map((row) => row.courseId))],
    }),
  ]);
  const teacherName = new Map(teachers.map((row) => [row.id, row.name]));
  const courseLabel = new Map(labels.map((row) => [row.id, row.label]));

  return rows.map((row) => ({
    enrollmentId: row.enrollmentId,
    state: row.state,
    courseId: row.courseId,
    courseLabel: courseLabel.get(row.courseId) ?? "Course",
    medium: row.medium,
    teacherName: teacherName.get(row.teacherId) ?? "Teacher",
    className: row.className,
    schedule: row.schedule,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  }));
}

/** Assignments across every active enrollment. */
export async function listMyAssignments(): Promise<StudentAssignmentRow[]> {
  const { actorId } = await requireStudentActor();

  const courseIds = await courseIdsOf(actorId, true);
  if (courseIds.length === 0) return [];

  const rows = await Promise.all(
    courseIds.map((courseId) => listStudentAssignments(actorId, courseId)),
  );
  return rows.flat().sort((a, b) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export type StudentAttendanceRow = {
  id: string;
  date: string;
  present: boolean;
  context: string;
};

/**
 * Attendance for this student. `attendance_records` is keyed by student, so no
 * "find my row in the embedded array" step is needed any more — the join already
 * returns only this child's rows.
 */
export async function listMyAttendance(): Promise<StudentAttendanceRow[]> {
  const { actorId } = await requireStudentActor();

  const rows = await db
    .select({
      id: attendanceSessions.id,
      date: attendanceSessions.date,
      present: attendanceRecords.present,
      className: classes.name,
    })
    .from(attendanceRecords)
    .innerJoin(
      attendanceSessions,
      eq(attendanceSessions.id, attendanceRecords.sessionId),
    )
    .leftJoin(classes, eq(classes.id, attendanceSessions.classId))
    .where(eq(attendanceRecords.studentId, actorId))
    .orderBy(desc(attendanceSessions.date))
    .limit(60);

  return rows.map((row) => ({
    id: row.id,
    // `date` is a Postgres `date`: anchor at UTC midnight, as `saveAttendance` did.
    date: new Date(`${row.date}T00:00:00.000Z`).toISOString(),
    present: row.present,
    context: row.className ?? "One-on-one",
  }));
}

export type StudentGradeRow = {
  id: string;
  title: string;
  courseLabel: string;
  score: number;
  feedback: string;
  gradedAt: string | null;
  submittedAt: string;
};

/** Graded submissions with the assignment title and course label. */
export async function listMyGrades(): Promise<StudentGradeRow[]> {
  const { actorId } = await requireStudentActor();

  const rows = await db
    .select({
      id: submissions.id,
      title: assignments.title,
      courseId: assignments.courseId,
      score: submissions.score,
      feedback: submissions.feedback,
      gradedAt: submissions.gradedAt,
      submittedAt: submissions.submittedAt,
      board: boards.name,
      level: levels.name,
      subject: subjects.name,
      medium: courses.medium,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .innerJoin(courses, eq(courses.id, assignments.courseId))
    .innerJoin(boards, eq(boards.id, courses.boardId))
    .innerJoin(levels, eq(levels.id, courses.levelId))
    .innerJoin(subjects, eq(subjects.id, courses.subjectId))
    .where(
      and(eq(submissions.studentId, actorId), isNotNull(submissions.score)),
    )
    .orderBy(desc(submissions.gradedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    courseLabel: `${row.board} / ${row.level} / ${row.subject}${
      row.medium ? ` / ${row.medium}` : ""
    }`,
    score: row.score ?? 0,
    feedback: row.feedback ?? "",
    gradedAt: row.gradedAt ? row.gradedAt.toISOString() : null,
    submittedAt: row.submittedAt.toISOString(),
  }));
}

export type StudentBookRow = {
  id: string;
  title: string;
  author: string;
  note: string;
  courseLabel: string;
};

/** Recommended books for the student's active courses. */
export async function listMyBooks(): Promise<StudentBookRow[]> {
  const { actorId } = await requireStudentActor();

  const courseIds = await courseIdsOf(actorId, true);
  if (courseIds.length === 0) return [];

  const [books, labels] = await Promise.all([
    listBooksForCourses(courseIds),
    listCourseLabels({ courseIds }),
  ]);
  const labelById = new Map(labels.map((row) => [row.id, row.label]));

  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    note: book.note ?? "",
    courseLabel: labelById.get(book.courseIds[0]) ?? "Course",
  }));
}

export type StudentMaterialRow = {
  id: string;
  title: string;
  type: "notes" | "past_paper" | "worksheet" | "other";
  fileUrl: string;
  courseLabel: string;
  createdAt: string;
};

/** Materials for the student's active courses. */
export async function listMyMaterials(): Promise<StudentMaterialRow[]> {
  const { actorId } = await requireStudentActor();

  const courseIds = await courseIdsOf(actorId, true);
  if (courseIds.length === 0) return [];

  const rows = await db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      fileUrl: materials.fileUrl,
      createdAt: materials.createdAt,
      courseId: materials.courseId,
    })
    .from(materials)
    .where(inArray(materials.courseId, courseIds))
    .orderBy(desc(materials.createdAt));

  const labels = await listCourseLabels({ courseIds });
  const labelById = new Map(labels.map((row) => [row.id, row.label]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    fileUrl: row.fileUrl,
    courseLabel: labelById.get(row.courseId) ?? "Course",
    createdAt: row.createdAt.toISOString(),
  }));
}

export type StudentProfile = {
  id: string;
  name: string;
  email: string;
  boardName: string | null;
  levelName: string | null;
  onboarded: boolean;
  teachers: { name: string; courseLabel: string; className: string | null }[];
  activeCourseCount: number;
};

/** Header data for the student panel: board, level and guardian status. */
export async function getMyProfile(): Promise<StudentProfile> {
  const { actorId } = await requireStudentActor();

  const [student, courseRows] = await Promise.all([
    findUserById(actorId),
    listMyCourses(),
  ]);

  const boardId = student?.student.boardId ?? null;
  const levelId = student?.student.levelId ?? null;
  const [boardRows, levelRows] = await Promise.all([
    boardId
      ? db
          .select({ name: boards.name })
          .from(boards)
          .where(eq(boards.id, boardId))
          .limit(1)
      : Promise.resolve([]),
    levelId
      ? db
          .select({ name: levels.name })
          .from(levels)
          .where(eq(levels.id, levelId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const active = courseRows.filter((item) => item.state === "active");

  return {
    id: student?.id ?? actorId,
    name: student?.name ?? "Student",
    email: student?.email ?? "",
    boardName: boardRows[0]?.name ?? null,
    levelName: levelRows[0]?.name ?? null,
    onboarded: Boolean(student?.onboarded),
    teachers: active.map((item) => ({
      name: item.teacherName,
      courseLabel: item.courseLabel,
      className: item.className,
    })),
    activeCourseCount: active.length,
  };
}

/** Used by the dashboard to show the class name of the active enrollment. */
export async function getMyClassSnapshot() {
  const { actorId } = await requireStudentActor();

  const [row] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      schedule: classes.schedule,
      classState: classes.state,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(eq(enrollments.studentId, actorId), eq(enrollments.state, "active")),
    )
    .limit(1);

  if (!row) return null;
  return {
    className: row.className,
    schedule: row.schedule,
    classState: row.classState,
    classId: row.classId,
  };
}
