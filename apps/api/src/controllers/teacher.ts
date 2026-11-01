import type { Request } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assignments, classes, enrollments, submissions } from "@/db/schema";
import { notFound } from "@/lib/http-error";
import { actorOf } from "@/middleware/auth";
import {
  listAttendance,
  listAttendanceForEnrollment,
  listTeacherAssignments,
} from "@/db/queries/assessment";
import { listEnrollments, type EnrollmentView } from "@/db/queries/enrollment";
import { listInvoicesForStudent } from "@/db/queries/invoices";
import { listParentIdsForStudent } from "@/db/queries/guardianships";
import { listMeetingsForTeacher } from "@/db/queries/meetings";
import {
  listCourseChoicesForTeacher,
  listTeacherClasses,
} from "@/db/queries/teaching";
import { findUserById, listUsersByIds } from "@/db/queries/users";

/**
 * Teacher panel reads. Every query filters on the signed-in teacher's id; no
 * client-supplied teacher id is accepted anywhere in this file.
 */

async function listMyStudents(teacherId: string) {
  const rows: EnrollmentView[] = await listEnrollments({
    teacherId,
    state: "active",
  });
  return rows.map((row) => ({
    enrollmentId: row.id,
    studentId: row.studentId,
    name: row.studentName,
    email: row.studentEmail,
    courseId: row.courseId,
    courseLabel: row.courseLabel,
    className: row.className,
    state: row.state,
    since: row.decidedAt ?? row.requestedAt,
  }));
}

async function listMyMeetings(teacherId: string) {
  const meetings = await listMeetingsForTeacher(teacherId);
  if (meetings.length === 0) return [];
  const people = await listUsersByIds([
    ...new Set(
      meetings.flatMap((meeting) => [meeting.parentId, meeting.studentId]),
    ),
  ]);
  const byId = new Map(people.map((person) => [person.id, person]));

  return meetings.map((meeting) => ({
    id: meeting.id,
    parentName: byId.get(meeting.parentId)?.name ?? "Parent",
    parentEmail: byId.get(meeting.parentId)?.email ?? "",
    studentName: byId.get(meeting.studentId)?.name ?? "Student",
    studentId: meeting.studentId,
    slots: meeting.requestedSlots.join(", "),
    state: meeting.state,
    confirmedAt: meeting.confirmedAt ? meeting.confirmedAt.toISOString() : null,
    createdAt: meeting.createdAt.toISOString(),
  }));
}

export async function listClasses(req: Request) {
  const teacherId = actorOf(req).id;
  const classRows = await listTeacherClasses(teacherId);
  if (classRows.length === 0) return [];

  const counts = await db
    .select({
      classId: enrollments.classId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.teacherId, teacherId),
        eq(enrollments.state, "active"),
      ),
    )
    .groupBy(enrollments.classId);

  const byClass = new Map(
    counts
      .filter(
        (row): row is typeof row & { classId: string } => row.classId !== null,
      )
      .map((row) => [row.classId, row.count]),
  );

  return classRows.map((item) => ({
    id: item.id,
    name: item.name,
    courseId: item.courseId,
    courseLabel: item.courseLabel,
    schedule: item.schedule,
    state: item.state,
    studentCount: byClass.get(item.id) ?? 0,
  }));
}

export const students = (req: Request) => listMyStudents(actorOf(req).id);
export const requests = (req: Request) =>
  listEnrollments({ teacherId: actorOf(req).id, state: "requested" });
export const myAssignments = (req: Request) =>
  listTeacherAssignments(actorOf(req).id);
export const myAttendance = (req: Request) => listAttendance(actorOf(req).id);
export const myMeetings = (req: Request) => listMyMeetings(actorOf(req).id);
export const courseChoices = (req: Request) =>
  listCourseChoicesForTeacher(actorOf(req).id);

export async function dashboard(req: Request) {
  const teacherId = actorOf(req).id;
  const teacher = await findUserById(teacherId);

  const [
    requestRows,
    studentRows,
    classRows,
    assignmentRows,
    meetingRows,
    courses,
  ] = await Promise.all([
    listEnrollments({ teacherId, state: "requested" }),
    listMyStudents(teacherId),
    listClasses(req),
    listTeacherAssignments(teacherId),
    listMyMeetings(teacherId),
    listCourseChoicesForTeacher(teacherId),
  ]);

  const all = assignmentRows.flatMap((item) => item.submissions);
  const graded = all.filter((item) => item.score !== null);

  return {
    name: teacher?.name ?? "Teacher",
    email: teacher?.email ?? "",
    students: studentRows.length,
    classes: classRows.filter((item) => item.state === "current").length,
    pendingRequests: requestRows.length,
    ungradedSubmissions: all.filter((item) => item.score === null).length,
    pendingMeetings: meetingRows.filter((item) => item.state === "requested")
      .length,
    averageScore: graded.length
      ? Math.round(
          graded.reduce((sum, item) => sum + (item.score ?? 0), 0) /
            graded.length,
        )
      : null,
    courses,
  };
}

/** One page for a student of this teacher. Guarded by an active enrollment. */
export async function studentDetail(req: Request) {
  const teacherId = actorOf(req).id;
  const studentId = String(req.params.id);

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.teacherId, teacherId),
        eq(enrollments.state, "active"),
      ),
    )
    .limit(1);
  if (!enrollment) throw notFound("Student not found");

  const [student, allStudents, assignmentRows, invoices, guardianIds] =
    await Promise.all([
      findUserById(studentId),
      listMyStudents(teacherId),
      listTeacherAssignments(teacherId),
      listInvoicesForStudent(studentId),
      listParentIdsForStudent(studentId),
    ]);
  const guardians = await listUsersByIds(guardianIds);
  const attendanceRows = await listAttendanceForEnrollment(enrollment.id);

  const gradedAssignments = assignmentRows.filter((item) =>
    item.submissions.some((row) => row.studentId === studentId),
  );

  return {
    id: studentId,
    name: student?.name ?? "Student",
    email: student?.email ?? "",
    enrollments: allStudents.filter((row) => row.studentId === studentId),
    attendance: attendanceRows,
    grades: gradedAssignments.flatMap((item) =>
      item.submissions
        .filter((row) => row.studentId === studentId && row.score !== null)
        .map((row) => ({
          title: item.title,
          score: row.score ?? 0,
          feedback: row.feedback,
        })),
    ),
    unpaidTotal: invoices
      .filter((invoice) => invoice.state === "unpaid")
      .reduce((sum, invoice) => sum + invoice.amount, 0),
    guardians: guardians.map((row) => ({ name: row.name, email: row.email })),
  };
}

export async function classDetail(req: Request) {
  const teacherId = actorOf(req).id;
  const classId = String(req.params.id);

  const [klass] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1);
  if (!klass) throw notFound("Class not found");

  const [classRows, studentRows, attendanceRows] = await Promise.all([
    listClasses(req),
    listMyStudents(teacherId),
    listAttendance(teacherId),
  ]);
  const row = classRows.find((item) => item.id === classId);

  return {
    id: classId,
    name: klass.name,
    courseLabel: row?.courseLabel ?? "Course",
    schedule: klass.schedule ?? "",
    state: klass.state,
    students: studentRows.filter((item) => item.className === klass.name),
    attendance: attendanceRows,
  };
}

/** Active enrollments this teacher has not put in a class yet. */
export async function unassignedCount(req: Request) {
  const teacherId = actorOf(req).id;
  const rows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.teacherId, teacherId),
        eq(enrollments.state, "active"),
        isNull(enrollments.classId),
      ),
    );
  return { count: rows.length };
}

/** Ungraded submissions across this teacher's assignments. */
export async function ungradedCount(req: Request) {
  const teacherId = actorOf(req).id;
  const mine = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(eq(assignments.teacherId, teacherId));
  if (mine.length === 0) return { count: 0 };

  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        inArray(
          submissions.assignmentId,
          mine.map((row) => row.id),
        ),
        isNull(submissions.score),
      ),
    );
  return { count: rows.length };
}
