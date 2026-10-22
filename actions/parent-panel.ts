"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { Enrollment } from "@/models/enrollment";
import { Assignment } from "@/models/assignment";
import { Submission } from "@/models/submission";
import { Attendance } from "@/models/attendance";
import { Invoice } from "@/models/invoice";
import { Meeting } from "@/models/meeting";
import { Course } from "@/models/course";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";
import { requireRole, requireParentOf } from "@/lib/auth/guards";
import { listGuardianChildren, type ChildRow } from "@/lib/guardians";
import { objectIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const shortId = (reference: unknown) => String(reference);

export type TeacherContact = {
  id: string;
  name: string;
  courseLabel: string;
  className: string | null;
};

export type ChildOverview = ChildRow & {
  teachers: TeacherContact[];
  /** Attendance rate, 0-100, null when nothing was recorded yet. */
  attendanceRate: number | null;
  latestGrades: { title: string; score: number; gradedAt: string | null }[];
  dueAmount: number;
  nextMeeting: { id: string; when: string; teacherName: string } | null;
};

/** Course labels resolved in a few queries instead of a populate per row. */
async function courseLabels(courseIds: string[]) {
  const [courses, boards, levels, subjects] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).lean(),
    Board.find().select("name").lean(),
    Level.find().select("name").lean(),
    Subject.find().select("name").lean(),
  ]);
  const boardNames = new Map(
    boards.map((item) => [shortId(item._id), item.name]),
  );
  const levelNames = new Map(
    levels.map((item) => [shortId(item._id), item.name]),
  );
  const subjectNames = new Map(
    subjects.map((item) => [shortId(item._id), item.name]),
  );

  return new Map(
    courses.map((course) => [
      shortId(course._id),
      `${boardNames.get(shortId(course.boardId)) ?? "Board"} / ${levelNames.get(shortId(course.levelId)) ?? "Level"} / ${subjectNames.get(shortId(course.subjectId)) ?? "Subject"}`,
    ]),
  );
}

/** Everything a parent sees for one child. Read only. */
export async function getChildOverview(
  studentId: string,
): Promise<ChildOverview | null> {
  const session = await requireRole(["parent"]);
  await connectDB();

  // Row guard: the child must be linked to this parent.
  const linked = await User.findOne({
    _id: studentId,
    role: "student",
    "student.guardianIds": session.actorId,
  })
    .select("name email student.boardId student.levelId")
    .populate("student.boardId", "name")
    .populate("student.levelId", "name")
    .lean();

  if (!linked) return null;

  const [enrollments, invoices, meetings] = await Promise.all([
    Enrollment.find({ studentId, state: "active" })
      .populate("teacherId", "name")
      .populate("classId", "name")
      .lean(),
    Invoice.find({ studentId, state: "unpaid" }).lean(),
    Meeting.find({
      studentId,
      state: { $in: ["requested", "confirmed", "rescheduled"] },
    })
      .populate("teacherId", "name")
      .sort({ confirmedAt: 1, createdAt: -1 })
      .lean(),
  ]);

  const labels = await courseLabels(
    enrollments.map((item) => shortId(item.courseId)),
  );

  const classIds = enrollments.map((item) => item.classId).filter(Boolean);
  const enrollmentIds = enrollments.map((item) => item._id);
  const [assignments, attendanceRows] = await Promise.all([
    Assignment.find({
      $or: [
        { classId: { $in: classIds } },
        { enrollmentId: { $in: enrollmentIds } },
      ],
    })
      .sort({ dueAt: -1 })
      .lean(),
    Attendance.find({
      $or: [
        { classId: { $in: classIds } },
        { enrollmentId: { $in: enrollmentIds } },
      ],
    }).lean(),
  ]);

  const submissions = await Submission.find({
    studentId,
    assignmentId: { $in: assignments.map((item) => item._id) },
    score: { $ne: null },
  })
    .sort({ gradedAt: -1 })
    .limit(5)
    .lean();
  const assignmentTitle = new Map(
    assignments.map((item) => [shortId(item._id), item.title]),
  );

  let present = 0;
  let recorded = 0;
  for (const row of attendanceRows) {
    const record = row.records.find(
      (entry: { studentId: unknown }) => shortId(entry.studentId) === studentId,
    );
    if (!record) continue;
    recorded += 1;
    if (record.present) present += 1;
  }

  const nextMeetingRow = meetings.find(
    (item) => item.confirmedAt && item.confirmedAt >= new Date(),
  );
  const openMeeting =
    nextMeetingRow ?? meetings.find((item) => item.state === "requested");

  return {
    id: String(linked._id),
    name: linked.name,
    email: linked.email,
    boardName:
      (linked.student?.boardId as unknown as { name?: string } | null)?.name ??
      null,
    levelName:
      (linked.student?.levelId as unknown as { name?: string } | null)?.name ??
      null,
    teachers: enrollments.map((item) => ({
      id: String(
        (item.teacherId as unknown as { _id?: unknown })?._id ?? item.teacherId,
      ),
      name:
        (item.teacherId as unknown as { name?: string } | null)?.name ??
        "Teacher",
      courseLabel: labels.get(shortId(item.courseId)) ?? "Course",
      className:
        (item.classId as unknown as { name?: string } | null)?.name ?? null,
    })),
    attendanceRate:
      recorded === 0 ? null : Math.round((present / recorded) * 100),
    latestGrades: submissions.map((submission) => ({
      title:
        assignmentTitle.get(shortId(submission.assignmentId)) ?? "Assignment",
      score: submission.score ?? 0,
      gradedAt: submission.gradedAt
        ? new Date(submission.gradedAt).toISOString()
        : null,
    })),
    dueAmount: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    nextMeeting: openMeeting
      ? {
          id: String(openMeeting._id),
          when: openMeeting.confirmedAt
            ? new Date(openMeeting.confirmedAt).toISOString()
            : `${openMeeting.requestedSlots?.slice(0, 2).join(", ") || "No slot yet"}`,
          teacherName:
            (openMeeting.teacherId as unknown as { name?: string } | null)
              ?.name ?? "Teacher",
        }
      : null,
  };
}

/** The parent dashboard: one row per linked child. */
export async function listChildOverviews(): Promise<ChildOverview[]> {
  const session = await requireRole(["parent"]);
  await connectDB();
  const children = await listGuardianChildren(session.actorId);
  const childIds = children.map((child) => child.id);

  const [enrollments, invoices, meetings] = await Promise.all([
    Enrollment.find({ studentId: { $in: childIds }, state: "active" })
      .populate("teacherId", "name")
      .populate("classId", "name")
      .lean(),
    Invoice.find({ studentId: { $in: childIds }, state: "unpaid" }).lean(),
    Meeting.find({
      studentId: { $in: childIds },
      state: { $in: ["requested", "confirmed", "rescheduled"] },
    })
      .populate("teacherId", "name")
      .sort({ confirmedAt: 1, createdAt: -1 })
      .lean(),
  ]);

  const [labels, submissions] = await Promise.all([
    courseLabels(enrollments.map((item) => shortId(item.courseId))),
    Submission.find({ studentId: { $in: childIds }, score: { $ne: null } })
      .sort({ gradedAt: -1 })
      .lean(),
  ]);

  const assignments = await Assignment.find({
    _id: { $in: submissions.map((item) => shortId(item.assignmentId)) },
  })
    .select("title")
    .lean();
  const assignmentTitle = new Map(
    assignments.map((item) => [shortId(item._id), item.title]),
  );

  const attendanceRows = await Attendance.find({
    $or: [
      { classId: { $in: enrollments.map((item) => item.classId).filter(Boolean) } },
      { enrollmentId: { $in: enrollments.map((item) => item._id) } },
    ],
  }).lean();

  return children.map((child) => {
    const childEnrollments = enrollments.filter(
      (item) => shortId(item.studentId) === child.id,
    );
    const childSubmissions = submissions.filter(
      (item) => shortId(item.studentId) === child.id,
    );

    let present = 0;
    let recorded = 0;
    for (const row of attendanceRows) {
      const record = row.records.find(
        (entry: { studentId: unknown }) => shortId(entry.studentId) === child.id,
      );
      if (!record) continue;
      recorded += 1;
      if (record.present) present += 1;
    }

    const childMeetings = meetings.filter(
      (item) => shortId(item.studentId) === child.id,
    );
    const meeting =
      childMeetings.find(
        (item) => item.confirmedAt && item.confirmedAt >= new Date(),
      ) ?? childMeetings.find((item) => item.state === "requested");

    return {
      ...child,
      teachers: childEnrollments.map((item) => ({
        id: String(
          (item.teacherId as unknown as { _id?: unknown })?._id ?? item.teacherId,
        ),
        name: (item.teacherId as unknown as { name?: string } | null)?.name ?? "Teacher",
        courseLabel: labels.get(shortId(item.courseId)) ?? "Course",
        className: (item.classId as unknown as { name?: string } | null)?.name ?? null,
      })),
      attendanceRate: recorded === 0 ? null : Math.round((present / recorded) * 100),
      latestGrades: childSubmissions.slice(0, 5).map((submission) => ({
        title: assignmentTitle.get(shortId(submission.assignmentId)) ?? "Assignment",
        score: submission.score ?? 0,
        gradedAt: submission.gradedAt
          ? new Date(submission.gradedAt).toISOString()
          : null,
      })),
      dueAmount: invoices
        .filter((invoice) => shortId(invoice.studentId) === child.id)
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      nextMeeting: meeting
        ? {
            id: String(meeting._id),
            when: meeting.confirmedAt
              ? new Date(meeting.confirmedAt).toISOString()
              : meeting.requestedSlots?.slice(0, 2).join(", ") || "No slot yet",
            teacherName:
              (meeting.teacherId as unknown as { name?: string } | null)?.name ??
              "Teacher",
          }
        : null,
    } satisfies ChildOverview;
  });
}

const meetingRequestSchema = z.object({
  studentId: objectIdSchema,
  preferredDay: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional(),
});

/**
 * A parent asks the child's teacher for a meeting. The teacher comes from the
 * child's active enrollment, never from client input, and the child must be
 * linked to this parent (row guard).
 */
export async function requestMeeting(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(["parent"]);
    const input = meetingRequestSchema.parse(raw);

    await requireParentOf(session.clerkId, input.studentId);
    await connectDB();

    const enrollment = await Enrollment.findOne({
      studentId: input.studentId,
      state: "active",
    })
      .sort({ decidedAt: -1 })
      .lean();
    if (!enrollment) {
      throw new Error("This child has no active teacher yet.");
    }

    const slot = input.note
      ? `${input.preferredDay} - ${input.note}`
      : input.preferredDay;

    await withTransaction(async (dbSession) => {
      await Meeting.create(
        [
          {
            parentId: session.actorId,
            teacherId: enrollment.teacherId,
            studentId: input.studentId,
            requestedSlots: [slot],
            state: "requested",
          },
        ],
        { session: dbSession },
      );
    });

    revalidatePath("/parent");
    revalidatePath("/parent/meetings");
    revalidatePath("/teacher/meetings");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** A parent asks the teacher to reschedule a confirmed meeting. */
export async function rescheduleMeeting(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(["parent"]);
    const input = z
      .object({
        meetingId: objectIdSchema,
        preferredDay: z.string().trim().min(1).max(60),
      })
      .parse(raw);
    await connectDB();

    const meeting = await Meeting.findOne({
      _id: input.meetingId,
      parentId: session.actorId,
    });
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw new Error("This meeting is already closed");
    }

    meeting.state = "rescheduled";
    meeting.confirmedAt = undefined;
    meeting.requestedSlots = [input.preferredDay];
    await meeting.save();

    revalidatePath("/parent/meetings");
    revalidatePath("/teacher/meetings");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
