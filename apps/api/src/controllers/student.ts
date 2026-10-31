import type { Request } from "express";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
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
import { forbidden } from "@/lib/http-error";
import { actorOf } from "@/middleware/auth";
import {
  listStudentAssignments,
  type StudentAssignmentRow,
} from "@/db/queries/assessment";
import {
  findActiveCourseIds,
  listCoursesBySubjectName,
} from "@/db/queries/courses";
import { listBooksForCourses } from "@/db/queries/books";
import { listCourseLabels } from "@/db/queries/teacher-courses";
import { findUserById, listUsersByIds } from "@/db/queries/users";

/**
 * Student panel reads. Every query scopes to the signed-in student's own id;
 * no client-supplied student id is accepted.
 */

async function courseIdsOf(studentId: string, onlyActive = false) {
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

export async function listMyCourses(req: Request) {
  const studentId = actorOf(req).id;

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
    .where(eq(enrollments.studentId, studentId))
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
export async function listMyAssignments(
  req: Request,
): Promise<StudentAssignmentRow[]> {
  const studentId = actorOf(req).id;
  const courseIds = await courseIdsOf(studentId, true);
  if (courseIds.length === 0) return [];

  const rows = await Promise.all(
    courseIds.map((courseId) => listStudentAssignments(studentId, courseId)),
  );
  return rows.flat().sort((a, b) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export async function listMyAttendance(req: Request) {
  const studentId = actorOf(req).id;

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
    .where(eq(attendanceRecords.studentId, studentId))
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

export async function listMyGrades(req: Request) {
  const studentId = actorOf(req).id;

  const rows = await db
    .select({
      id: submissions.id,
      title: assignments.title,
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
      and(eq(submissions.studentId, studentId), isNotNull(submissions.score)),
    )
    .orderBy(desc(submissions.gradedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    courseLabel: `${row.board} / ${row.level} / ${row.subject}${row.medium ? ` / ${row.medium}` : ""}`,
    score: row.score ?? 0,
    feedback: row.feedback ?? "",
    gradedAt: row.gradedAt ? row.gradedAt.toISOString() : null,
    submittedAt: row.submittedAt.toISOString(),
  }));
}

export async function listMyBooks(req: Request) {
  const studentId = actorOf(req).id;
  const courseIds = await courseIdsOf(studentId, true);
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

export async function listMyMaterials(req: Request) {
  const studentId = actorOf(req).id;
  const courseIds = await courseIdsOf(studentId, true);
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

/** Header data for the student panel: board, level and teachers. */
export async function profile(req: Request) {
  const studentId = actorOf(req).id;

  const [student, courseRows, classroom] = await Promise.all([
    findUserById(studentId),
    listMyCourses(req),
    classSnapshot(req),
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
    id: student?.id ?? studentId,
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
    classSnapshot: classroom,
  };
}

export async function classSnapshot(req: Request) {
  const studentId = actorOf(req).id;
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
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.state, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The student's own submission for one assignment, if any. */
export async function mySubmission(req: Request) {
  const studentId = actorOf(req).id;
  const assignmentId = String(req.query.assignmentId ?? "");

  const [row] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Courses matching the student's board and level. */
export async function myCourseOptions(req: Request) {
  const student = await findUserById(actorOf(req).id);
  const boardId = student?.student.boardId;
  const levelId = student?.student.levelId;
  if (!boardId || !levelId) return [];

  const [courseRows, subjectRows] = await Promise.all([
    listCoursesBySubjectName({ boardId, levelId, active: true }),
    db.select({ id: subjects.id, name: subjects.name }).from(subjects),
  ]);
  const names = new Map(
    subjectRows.map((subject) => [subject.id, subject.name]),
  );

  return courseRows.map((course) => ({
    id: course.id,
    label: `${names.get(course.subjectId) ?? "Subject"}${course.medium ? ` / ${course.medium}` : ""}`,
  }));
}

/**
 * Books for the courses a student asked about. Every requested course must be
 * on the student's own board and level: an allow-list, not a filter.
 */
export async function myBookOptions(req: Request) {
  const student = await findUserById(actorOf(req).id);
  const boardId = student?.student.boardId;
  const levelId = student?.student.levelId;

  const requested = String(req.query.courseIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const permittedCourseIds =
    boardId && levelId
      ? await findActiveCourseIds(
          (
            await listCoursesBySubjectName({ boardId, levelId, active: true })
          ).map((c) => c.id),
        )
      : [];

  const permitted = new Set(permittedCourseIds);
  if (requested.some((id) => !permitted.has(id))) {
    throw forbidden("Course access denied");
  }

  const books = await listBooksForCourses(requested);
  return books.map((book) => ({
    id: book.id,
    label: book.author ? `${book.title} - ${book.author}` : book.title,
    courseIds: book.courseIds,
  }));
}
