"use server";

import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assignments, classes, enrollments, submissions } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { listEnrollments, type EnrollmentView } from "@/lib/queries/enrollment";
import {
  listTeacherClasses,
  listCourseChoicesForTeacher,
} from "@/lib/queries/teaching";
import {
  listAttendance,
  listAttendanceForEnrollment,
  listTeacherAssignments,
} from "@/lib/queries/assessment";
import { listInvoicesForStudent } from "@/lib/queries/invoices";
import { listParentIdsForStudent } from "@/lib/queries/guardianships";
import { listMeetingsForTeacher } from "@/lib/queries/meetings";
import { listUsersByIds, findUserById } from "@/lib/queries/users";
import type { Id } from "@/lib/types";

/** The teacher's own record. Every read below filters on this id. */
async function requireTeacherActor() {
  const session = await requireRole(["teacher"]);
  return { actorId: session.actorId as Id, session };
}

export type TeacherClassRow = {
  id: string;
  name: string;
  courseId: string;
  courseLabel: string;
  schedule: string;
  state: "current" | "past";
  studentCount: number;
};

export async function listClasses(): Promise<TeacherClassRow[]> {
  const { actorId } = await requireTeacherActor();
  const classRows = await listTeacherClasses(actorId);
  if (classRows.length === 0) return [];

  // Was an aggregation pipeline; this is a GROUP BY on the same column.
  const counts = await db
    .select({
      classId: enrollments.classId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(enrollments)
    .where(
      and(eq(enrollments.teacherId, actorId), eq(enrollments.state, "active")),
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
    state: item.state as "current" | "past",
    studentCount: byClass.get(item.id) ?? 0,
  }));
}

export type TeacherStudentRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  email: string;
  courseId: string;
  courseLabel: string;
  className: string | null;
  state: string;
  since: string;
};

/** Active students of this teacher, one row per enrollment. */
export async function listMyStudents(): Promise<TeacherStudentRow[]> {
  const { actorId } = await requireTeacherActor();
  const rows: EnrollmentView[] = await listEnrollments({
    teacherId: actorId,
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

/** Students waiting for this teacher to accept or decline. */
export async function listStudentRequests(): Promise<EnrollmentView[]> {
  const { actorId } = await requireTeacherActor();
  return listEnrollments({ teacherId: actorId, state: "requested" });
}

export type TeacherAssignmentRow = Awaited<
  ReturnType<typeof listTeacherAssignments>
>[number];

export async function listMyAssignments(): Promise<TeacherAssignmentRow[]> {
  const { actorId } = await requireTeacherActor();
  return listTeacherAssignments(actorId);
}

export type AttendanceEntry = Awaited<
  ReturnType<typeof listAttendance>
>[number];

export async function listMyAttendance(): Promise<AttendanceEntry[]> {
  const { actorId } = await requireTeacherActor();
  return listAttendance(actorId);
}

export type TeacherMeetingRow = {
  id: string;
  parentName: string;
  parentEmail: string;
  studentName: string;
  studentId: string;
  slots: string;
  state: string;
  confirmedAt: string | null;
  createdAt: string;
};

export async function listMyMeetings(): Promise<TeacherMeetingRow[]> {
  const { actorId } = await requireTeacherActor();
  const meetings = await listMeetingsForTeacher(actorId);
  if (meetings.length === 0) return [];

  // Two names per meeting: parent and student. One `IN` read covers both.
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

export type TeacherCourseOption = { id: string; label: string };

export async function listMyCourseChoices(): Promise<TeacherCourseOption[]> {
  const { actorId } = await requireTeacherActor();
  return listCourseChoicesForTeacher(actorId);
}

export type TeacherDashboard = {
  name: string;
  email: string;
  students: number;
  classes: number;
  pendingRequests: number;
  ungradedSubmissions: number;
  pendingMeetings: number;
  averageScore: number | null;
  courses: TeacherCourseOption[];
};

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const { session, actorId } = await requireTeacherActor();
  const teacher = await findUserById(actorId);

  const [requests, students, classRows, myAssignments, meetings, courses] =
    await Promise.all([
      listStudentRequests(),
      listMyStudents(),
      listClasses(),
      listMyAssignments(),
      listMyMeetings(),
      listMyCourseChoices(),
    ]);

  const all = myAssignments.flatMap((item) => item.submissions);
  const graded = all.filter((item) => item.score !== null);
  const averageScore = graded.length
    ? Math.round(
        graded.reduce((sum, item) => sum + (item.score ?? 0), 0) /
          graded.length,
      )
    : null;

  return {
    name: teacher?.name ?? "Teacher",
    email: teacher?.email ?? "",
    students: students.length,
    classes: classRows.filter((item) => item.state === "current").length,
    pendingRequests: requests.length,
    ungradedSubmissions: all.filter((item) => item.score === null).length,
    pendingMeetings: meetings.filter((item) => item.state === "requested")
      .length,
    averageScore,
    courses,
  };
}

export type TeacherStudentDetail = {
  id: string;
  name: string;
  email: string;
  enrollments: TeacherStudentRow[];
  attendance: AttendanceEntry[];
  grades: { title: string; score: number; feedback: string }[];
  unpaidTotal: number;
  guardians: { name: string; email: string }[];
};

/** One page for a student of this teacher. Guarded by an active enrollment. */
export async function getStudentDetail(
  studentId: string,
): Promise<TeacherStudentDetail | null> {
  const { actorId } = await requireTeacherActor();

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.teacherId, actorId),
        eq(enrollments.state, "active"),
      ),
    )
    .limit(1);
  if (!enrollment) return null;

  const [student, allStudents, myAssignments, invoices, guardianIds] =
    await Promise.all([
      findUserById(studentId),
      listMyStudents(),
      listMyAssignments(),
      listInvoicesForStudent(studentId),
      listParentIdsForStudent(studentId),
    ]);

  const guardians = await listUsersByIds(guardianIds);

  const gradedAssignments = myAssignments.filter((item) =>
    item.submissions.some((row) => row.studentId === studentId),
  );

  // Attendance for this one child: sessions hang off their enrollment, not off
  // the teacher's whole class list.
  const attendanceRows = await listAttendanceForEnrollment(enrollment.id);

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

export type ClassDetail = {
  id: string;
  name: string;
  courseLabel: string;
  schedule: string;
  state: string;
  students: TeacherStudentRow[];
  attendance: AttendanceEntry[];
};

export async function getClassDetail(
  classId: string,
): Promise<ClassDetail | null> {
  const { actorId } = await requireTeacherActor();

  const [klass] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, actorId)))
    .limit(1);
  if (!klass) return null;

  const [classRows, students, attendanceRows] = await Promise.all([
    listClasses(),
    listMyStudents(),
    listAttendance(actorId),
  ]);
  const row = classRows.find((item) => item.id === classId);

  return {
    id: classId,
    name: klass.name,
    courseLabel: row?.courseLabel ?? "Course",
    schedule: klass.schedule ?? "",
    state: klass.state,
    students: students.filter((item) => item.className === klass.name),
    attendance: attendanceRows,
  };
}

/** Active enrollments this teacher has not put in a class yet. */
export async function countUnassignedStudents(): Promise<number> {
  const { actorId } = await requireTeacherActor();
  const rows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.teacherId, actorId),
        eq(enrollments.state, "active"),
        isNull(enrollments.classId),
      ),
    );
  return rows.length;
}

/** Ungraded submissions across this teacher's assignments. */
export async function countSubmissionsForTeacher(): Promise<number> {
  const { actorId } = await requireTeacherActor();

  const mine = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(eq(assignments.teacherId, actorId));
  if (mine.length === 0) return 0;

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
  return rows.length;
}
