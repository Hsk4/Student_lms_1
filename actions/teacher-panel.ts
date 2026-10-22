"use server";

import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Enrollment } from "@/models/enrollment";
import { Assignment } from "@/models/assignment";
import { Submission } from "@/models/submission";
import { Attendance } from "@/models/attendance";
import { Meeting } from "@/models/meeting";
import { Class } from "@/models/class";
import { Invoice } from "@/models/invoice";
import { listEnrollments, type EnrollmentView } from "@/lib/queries/enrollment";
import {
  listTeacherClasses,
  listCourseChoicesForTeacher,
} from "@/lib/queries/teaching";
import {
  listTeacherAssignments,
  listAttendance,
} from "@/lib/queries/assessment";

const shortId = (reference: unknown) => String(reference);

/** The teacher's own record. Every read below filters on this id. */
async function requireTeacherActor() {
  const session = await requireRole(["teacher"]);
  return { actorId: session.actorId, session };
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
  const classes = await listTeacherClasses(actorId);
  if (!classes.length) return [];

  const counts = await Enrollment.aggregate<{ _id: unknown; count: number }>([
    { $match: { teacherId: await currentObjectId(actorId), state: "active" } },
    { $group: { _id: "$classId", count: { $sum: 1 } } },
  ]);
  const byClass = new Map(counts.map((row) => [shortId(row._id), row.count]));

  return classes.map((item) => ({
    id: item.id,
    name: item.name,
    courseId: item.courseId,
    courseLabel: item.courseLabel,
    schedule: item.schedule,
    state: item.state as "current" | "past",
    studentCount: byClass.get(item.id) ?? 0,
  }));
}

async function currentObjectId(id: string) {
  const { Types } = await import("mongoose");
  return new Types.ObjectId(id);
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
  await connectDB();

  const meetings = await Meeting.find({ teacherId: actorId })
    .populate("parentId", "name email")
    .populate("studentId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return meetings.map((meeting) => ({
    id: shortId(meeting._id),
    parentName:
      (meeting.parentId as unknown as { name?: string } | null)?.name ??
      "Parent",
    parentEmail:
      (meeting.parentId as unknown as { email?: string } | null)?.email ?? "",
    studentName:
      (meeting.studentId as unknown as { name?: string } | null)?.name ??
      "Student",
    studentId: shortId(meeting.studentId),
    slots: meeting.requestedSlots?.join(", ") ?? "",
    state: meeting.state,
    confirmedAt: meeting.confirmedAt
      ? new Date(meeting.confirmedAt).toISOString()
      : null,
    createdAt: new Date(meeting.createdAt).toISOString(),
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
  const { session } = await requireTeacherActor();
  await connectDB();
  const teacher = await User.findById(session.actorId).select("name email").lean();

  const [
    requests,
    students,
    classes,
    assignments,
    meetings,
    courses,
  ] = await Promise.all([
    listStudentRequests(),
    listMyStudents(),
    listClasses(),
    listMyAssignments(),
    listMyMeetings(),
    listMyCourseChoices(),
  ]);

  const submissions = assignments.flatMap((item) => item.submissions);
  const graded = submissions.filter((item) => item.score !== null);
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
    classes: classes.filter((item) => item.state === "current").length,
    pendingRequests: requests.length,
    ungradedSubmissions: submissions.filter((item) => item.score === null)
      .length,
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
  await connectDB();

  const enrollment = await Enrollment.findOne({
    studentId,
    teacherId: actorId,
    state: "active",
  }).lean();
  if (!enrollment) return null;

  const [student, allStudents, assignments, invoices] = await Promise.all([
    User.findById(studentId).select("name email student.guardianIds").lean(),
    listMyStudents(),
    listMyAssignments(),
    Invoice.find({ studentId, state: "unpaid" }).lean(),
  ]);

  const guardianIds = (student?.student?.guardianIds ?? []).map(String);
  const guardians = guardianIds.length
    ? await User.find({ _id: { $in: guardianIds } })
        .select("name email")
        .lean()
    : [];

  const gradedAssignments = assignments.filter((item) =>
    item.submissions.some((row) => row.studentId === studentId),
  );

  const attendanceRows = await Attendance.find({
    enrollmentId: enrollment._id,
  }).lean();

  return {
    id: studentId,
    name: student?.name ?? "Student",
    email: student?.email ?? "",
    enrollments: allStudents.filter((row) => row.studentId === studentId),
    attendance: attendanceRows.map((row) => ({
      id: shortId(row._id),
      date: new Date(row.date).toISOString(),
      present: row.records.filter(
        (record: { present: boolean }) => record.present,
      ).length,
      total: row.records.length,
    })),
    grades: gradedAssignments.flatMap((item) =>
      item.submissions
        .filter((row) => row.studentId === studentId && row.score !== null)
        .map((row) => ({
          title: item.title,
          score: row.score ?? 0,
          feedback: row.feedback,
        })),
    ),
    unpaidTotal: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
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
  attendance: { id: string; date: string; present: number; total: number }[];
};

export async function getClassDetail(
  classId: string,
): Promise<ClassDetail | null> {
  const { actorId } = await requireTeacherActor();
  await connectDB();

  const klass = await Class.findOne({
    _id: classId,
    teacherId: actorId,
  }).lean();
  if (!klass) return null;

  const [classes, students, attendanceRows] = await Promise.all([
    listClasses(),
    listMyStudents(),
    Attendance.find({ classId: klass._id }).sort({ date: -1 }).limit(30).lean(),
  ]);
  const row = classes.find((item) => item.id === classId);

  return {
    id: classId,
    name: klass.name,
    courseLabel: row?.courseLabel ?? "Course",
    schedule: klass.schedule ?? "",
    state: klass.state,
    students: students.filter((item) => item.className === klass.name),
    attendance: attendanceRows.map((entry) => ({
      id: shortId(entry._id),
      date: new Date(entry.date).toISOString(),
      present: entry.records.filter(
        (record: { present: boolean }) => record.present,
      ).length,
      total: entry.records.length,
    })),
  };
}

/** Close a class and move its active enrollments to "ended" in one transaction. */
export async function countUnassignedStudents(): Promise<number> {
  const { actorId } = await requireTeacherActor();
  await connectDB();
  return Enrollment.countDocuments({
    teacherId: actorId,
    state: "active",
    classId: null,
  });
}
export async function countSubmissionsForTeacher(): Promise<number> {
  const { actorId } = await requireTeacherActor();
  await connectDB();
  const assignments = await Assignment.find({ teacherId: actorId })
    .select("_id")
    .lean();
  return Submission.countDocuments({
    assignmentId: { $in: assignments.map((item) => item._id) },
    score: null,
  });
}
