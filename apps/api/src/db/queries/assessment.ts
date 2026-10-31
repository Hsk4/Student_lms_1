import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  assignments,
  attendanceRecords,
  attendanceSessions,
  classes,
  enrollments,
  submissions,
} from "@/db/schema";
import type { Assignment, AssignmentTarget, Id, Submission } from "@/db/types";

/**
 * Assignments, submissions and attendance. Postgres-backed.
 *
 * Attendance used to be one document with an embedded `records[]` array. It is
 * two tables now — `attendance_sessions` (one per class/enrollment per day) plus
 * `attendance_records` (one row per student) — so the counts below are an
 * aggregate rather than a filter over an array.
 */

type AssignmentRow = typeof assignments.$inferSelect;
type SubmissionRow = typeof submissions.$inferSelect;

export function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    courseId: row.courseId,
    teacherId: row.teacherId,
    ...targetOf(row),
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    text: row.text,
    fileUrl: row.fileUrl,
    submittedAt: row.submittedAt,
    score: row.score,
    feedback: row.feedback,
    gradedBy: row.gradedBy,
    gradedAt: row.gradedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The CHECK guarantees exactly one target; this narrows it to match the type. */
function targetOf(row: {
  classId: Id | null;
  enrollmentId: Id | null;
}): AssignmentTarget {
  if (row.classId) return { classId: row.classId, enrollmentId: null };
  return { classId: null, enrollmentId: row.enrollmentId as Id };
}

export type StudentAssignmentRow = {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  submissionId: string | null;
  score: number | null;
  feedback: string;
};

/** Students can see assignments for a class they are enrolled in, or for their one-on-one enrollment. */
export async function listStudentAssignments(
  studentId: Id,
  courseId: Id,
  conn: Tx | typeof db = db,
): Promise<StudentAssignmentRow[]> {
  const active = await conn
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.state, "active"),
      ),
    );
  if (active.length === 0) return [];

  const classIds = active
    .map((item) => item.classId)
    .filter((id): id is Id => id !== null);
  const enrollmentIds = active.map((item) => item.id);

  const targetClauses = [
    classIds.length > 0 ? inArray(assignments.classId, classIds) : undefined,
    inArray(assignments.enrollmentId, enrollmentIds),
  ].filter(
    (clause): clause is ReturnType<typeof inArray> => clause !== undefined,
  );

  const rows = await conn
    .select()
    .from(assignments)
    .where(and(eq(assignments.courseId, courseId), or(...targetClauses)))
    .orderBy(asc(assignments.dueAt));

  if (rows.length === 0) return [];

  const mine = await conn
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.studentId, studentId),
        inArray(
          submissions.assignmentId,
          rows.map((row) => row.id),
        ),
      ),
    );
  const byAssignment = new Map(mine.map((item) => [item.assignmentId, item]));

  return rows.map((row) => {
    const submission = byAssignment.get(row.id);
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      submissionId: submission?.id ?? null,
      score: submission?.score ?? null,
      feedback: submission?.feedback ?? "",
    };
  });
}

export async function listTeacherAssignments(
  teacherId: Id,
  conn: Tx | typeof db = db,
) {
  const rows = await conn
    .select()
    .from(assignments)
    .where(eq(assignments.teacherId, teacherId))
    .orderBy(desc(assignments.createdAt));

  const submitted =
    rows.length === 0
      ? []
      : await conn
          .select()
          .from(submissions)
          .where(
            inArray(
              submissions.assignmentId,
              rows.map((row) => row.id),
            ),
          );

  const byAssignment = new Map<Id, SubmissionRow[]>();
  for (const submission of submitted) {
    const current = byAssignment.get(submission.assignmentId);
    if (current) current.push(submission);
    else byAssignment.set(submission.assignmentId, [submission]);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    classId: row.classId,
    enrollmentId: row.enrollmentId,
    submissions: (byAssignment.get(row.id) ?? []).map((submission) => ({
      id: submission.id,
      studentId: submission.studentId,
      text: submission.text ?? "",
      score: submission.score,
      feedback: submission.feedback ?? "",
    })),
  }));
}

/** Present / total per session. `records` is a child table, so this is a GROUP BY. */
export async function listAttendance(teacherId: Id, conn: Tx | typeof db = db) {
  const taught = await conn
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.teacherId, teacherId));
  const enrolled = await conn
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.teacherId, teacherId));

  const classIds = taught.map((row) => row.id);
  const enrollmentIds = enrolled.map((row) => row.id);
  if (classIds.length === 0 && enrollmentIds.length === 0) return [];

  const targetClauses = [
    classIds.length > 0
      ? inArray(attendanceSessions.classId, classIds)
      : undefined,
    enrollmentIds.length > 0
      ? inArray(attendanceSessions.enrollmentId, enrollmentIds)
      : undefined,
  ].filter(
    (clause): clause is ReturnType<typeof inArray> => clause !== undefined,
  );

  const rows = await conn
    .select({
      id: attendanceSessions.id,
      date: attendanceSessions.date,
      present:
        sql<number>`count(${attendanceRecords.studentId}) filter (where ${attendanceRecords.present})`.mapWith(
          Number,
        ),
      total: sql<number>`count(${attendanceRecords.studentId})`.mapWith(Number),
    })
    .from(attendanceSessions)
    .leftJoin(
      attendanceRecords,
      eq(attendanceRecords.sessionId, attendanceSessions.id),
    )
    .where(or(...targetClauses))
    .groupBy(attendanceSessions.id, attendanceSessions.date)
    .orderBy(desc(attendanceSessions.date))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    // `date` is a Postgres `date`, so it arrives as "YYYY-MM-DD"; anchoring it at
    // UTC midnight keeps the ISO string the same calendar day the teacher logged.
    date: new Date(`${row.date}T00:00:00.000Z`).toISOString(),
    present: row.present,
    total: row.total,
  }));
}

/** Present / total for one enrollment's sessions — a single student's history. */
export async function listAttendanceForEnrollment(
  enrollmentId: Id,
  conn: Tx | typeof db = db,
) {
  const rows = await conn
    .select({
      id: attendanceSessions.id,
      date: attendanceSessions.date,
      present: sql<number>`count(${attendanceRecords.studentId}) filter (where ${attendanceRecords.present})`.mapWith(
        Number,
      ),
      total: sql<number>`count(${attendanceRecords.studentId})`.mapWith(Number),
    })
    .from(attendanceSessions)
    .leftJoin(
      attendanceRecords,
      eq(attendanceRecords.sessionId, attendanceSessions.id),
    )
    .where(eq(attendanceSessions.enrollmentId, enrollmentId))
    .groupBy(attendanceSessions.id, attendanceSessions.date)
    .orderBy(desc(attendanceSessions.date))
    .limit(30);

  return rows.map((row) => ({
    id: row.id,
    date: new Date(`${row.date}T00:00:00.000Z`).toISOString(),
    present: row.present,
    total: row.total,
  }));
}

export async function findAssignmentById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Assignment | null> {
  const [row] = await conn
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1);
  return row ? toAssignment(row) : null;
}

export async function findSubmissionFor(
  assignmentId: Id,
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<Submission | null> {
  const [row] = await conn
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId),
      ),
    )
    .limit(1);
  return row ? toSubmission(row) : null;
}
