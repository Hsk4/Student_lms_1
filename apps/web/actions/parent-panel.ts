"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assignments,
  attendanceRecords,
  classes,
  enrollments,
  invoices,
  meetings,
  submissions,
} from "@/db/schema";
import { requireRole, requireParentOf } from "@/lib/auth/guards";
import {
  isGuardianOf,
  listGuardianChildren,
  type ChildRow,
} from "@/lib/queries/guardianships";
import {
  createMeeting,
  findMeetingById,
  updateMeeting,
} from "@/lib/queries/meetings";
import { listCourseLabels } from "@/lib/queries/teacher-courses";
import { findUserById, listUsersByIds } from "@/lib/queries/users";
import { writeAudit } from "@/lib/audit";
import { recordIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

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

/**
 * Everything a parent sees for one child, for a set of children, in one pass.
 * The dashboard calls it with every linked child; the detail page calls it with
 * one, which is why the guard is a parameter rather than baked in.
 */
async function overviewsFor(children: ChildRow[]): Promise<ChildOverview[]> {
  if (children.length === 0) return [];
  const childIds = children.map((child) => child.id);

  const [enrollmentRows, invoiceRows, meetingRows, gradeRows] =
    await Promise.all([
      db
        .select({
          id: enrollments.id,
          studentId: enrollments.studentId,
          teacherId: enrollments.teacherId,
          courseId: enrollments.courseId,
          className: classes.name,
        })
        .from(enrollments)
        .leftJoin(classes, eq(classes.id, enrollments.classId))
        .where(
          and(
            inArray(enrollments.studentId, childIds),
            eq(enrollments.state, "active"),
          ),
        ),
      db
        .select()
        .from(invoices)
        .where(
          and(
            inArray(invoices.studentId, childIds),
            eq(invoices.state, "unpaid"),
          ),
        ),
      db
        .select()
        .from(meetings)
        .where(
          and(
            inArray(meetings.studentId, childIds),
            inArray(meetings.state, ["requested", "confirmed", "rescheduled"]),
          ),
        )
        .orderBy(asc(meetings.confirmedAt), desc(meetings.createdAt)),
      db
        .select({
          studentId: submissions.studentId,
          score: submissions.score,
          gradedAt: submissions.gradedAt,
          title: assignments.title,
        })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .where(
          and(
            inArray(submissions.studentId, childIds),
            isNotNull(submissions.score),
          ),
        )
        .orderBy(desc(submissions.gradedAt)),
    ]);

  // Attendance: this child's rows only, which the join now guarantees.
  const attendance = await db
    .select({
      studentId: attendanceRecords.studentId,
      present: attendanceRecords.present,
    })
    .from(attendanceRecords)
    .where(inArray(attendanceRecords.studentId, childIds));

  const [people, labels] = await Promise.all([
    listUsersByIds([
      ...new Set([
        ...enrollmentRows.map((row) => row.teacherId),
        ...meetingRows.map((row) => row.teacherId),
      ]),
    ]),
    listCourseLabels({
      courseIds: [...new Set(enrollmentRows.map((row) => row.courseId))],
    }),
  ]);
  const personName = new Map(people.map((row) => [row.id, row.name]));
  const labelById = new Map(labels.map((row) => [row.id, row.label]));

  const now = new Date();

  return children.map((child) => {
    const childEnrollments = enrollmentRows.filter(
      (row) => row.studentId === child.id,
    );
    const childAttendance = attendance.filter(
      (row) => row.studentId === child.id,
    );
    const recorded = childAttendance.length;
    const present = childAttendance.filter((row) => row.present).length;

    const childGrades = gradeRows
      .filter((row) => row.studentId === child.id)
      .slice(0, 5)
      .map((row) => ({
        title: row.title,
        score: row.score ?? 0,
        gradedAt: row.gradedAt ? row.gradedAt.toISOString() : null,
      }));

    const childMeetings = meetingRows.filter(
      (row) => row.studentId === child.id,
    );
    const meeting =
      childMeetings.find((row) => row.confirmedAt && row.confirmedAt >= now) ??
      childMeetings.find((row) => row.state === "requested") ??
      childMeetings[0];

    return {
      ...child,
      teachers: childEnrollments.map((row) => ({
        id: row.teacherId,
        name: personName.get(row.teacherId) ?? "Teacher",
        courseLabel: labelById.get(row.courseId) ?? "Course",
        className: row.className,
      })),
      attendanceRate:
        recorded === 0 ? null : Math.round((present / recorded) * 100),
      latestGrades: childGrades,
      dueAmount: invoiceRows
        .filter((row) => row.studentId === child.id)
        .reduce((sum, row) => sum + Number(row.amount), 0),
      nextMeeting: meeting
        ? {
            id: meeting.id,
            when: meeting.confirmedAt
              ? meeting.confirmedAt.toISOString()
              : meeting.requestedSlots.slice(0, 2).join(", ") || "No slot yet",
            teacherName: personName.get(meeting.teacherId) ?? "Teacher",
          }
        : null,
    } satisfies ChildOverview;
  });
}

/** Everything a parent sees for one child. Read only. */
export async function getChildOverview(
  studentId: string,
): Promise<ChildOverview | null> {
  const session = await requireRole(["parent"]);
  const id = recordIdSchema.parse(studentId);

  // Row guard: the child must be linked to this parent.
  if (!(await isGuardianOf(session.actorId, id))) return null;

  const child = await findUserById(id);
  if (!child || child.role !== "student") return null;

  const children = await listGuardianChildren(session.actorId);
  const row = children.find((entry) => entry.id === id);
  if (!row) return null;

  const [overview] = await overviewsFor([row]);
  return overview ?? null;
}

/** The parent dashboard: one row per linked child. */
export async function listChildOverviews(): Promise<ChildOverview[]> {
  const session = await requireRole(["parent"]);
  const children = await listGuardianChildren(session.actorId);
  return overviewsFor(children);
}

const meetingRequestSchema = z.object({
  studentId: recordIdSchema,
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

    const [enrollment] = await db
      .select({ teacherId: enrollments.teacherId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, input.studentId),
          eq(enrollments.state, "active"),
        ),
      )
      .orderBy(desc(enrollments.decidedAt))
      .limit(1);
    if (!enrollment) {
      throw new Error("This child has no active teacher yet.");
    }

    const slot = input.note
      ? `${input.preferredDay} - ${input.note}`
      : input.preferredDay;

    await db.transaction(async (tx) => {
      const meeting = await createMeeting(
        {
          parentId: session.actorId,
          teacherId: enrollment.teacherId,
          studentId: input.studentId,
          requestedSlots: [slot],
        },
        tx,
      );

      await writeAudit(
        {
          actorId: session.actorId,
          action: "requestMeeting",
          targetType: "Meeting",
          targetId: meeting.id,
          after: {
            studentId: input.studentId,
            teacherId: enrollment.teacherId,
          },
        },
        { tx },
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
        meetingId: recordIdSchema,
        preferredDay: z.string().trim().min(1).max(60),
      })
      .parse(raw);

    await db.transaction(async (tx) => {
      const meeting = await findMeetingById(input.meetingId, tx);
      if (!meeting || meeting.parentId !== session.actorId) {
        throw new Error("Meeting not found");
      }
      if (meeting.state === "cancelled" || meeting.state === "done") {
        throw new Error("This meeting is already closed");
      }

      await updateMeeting(
        meeting.id,
        {
          state: "rescheduled",
          confirmedAt: null,
          requestedSlots: [input.preferredDay],
        },
        tx,
      );

      await writeAudit(
        {
          actorId: session.actorId,
          action: "rescheduleMeeting",
          targetType: "Meeting",
          targetId: meeting.id,
          before: { state: meeting.state, slots: meeting.requestedSlots },
          after: { state: "rescheduled", slots: [input.preferredDay] },
        },
        { tx },
      );
    });

    revalidatePath("/parent/meetings");
    revalidatePath("/teacher/meetings");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
