import type { Request } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { recordIdSchema } from "@lms/shared";
import { db } from "@/db";
import {
  assignments,
  attendanceRecords,
  classes,
  enrollments,
  invoices,
  meetings,
  submissions,
} from "@/db/schema";
import { notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import { assertParentOf } from "@/lib/ownership";
import {
  isGuardianOf,
  listGuardianChildren,
  type ChildRow,
} from "@/db/queries/guardianships";
import {
  createMeeting,
  findMeetingById,
  updateMeeting,
} from "@/db/queries/meetings";
import { listCourseLabels } from "@/db/queries/teacher-courses";
import { findUserById, listUsersByIds } from "@/db/queries/users";

/**
 * Parent panel. Every read starts from the parent's own `guardianships` rows;
 * a child id from the client is checked with `assertParentOf` before use.
 */

type Overview = ChildRow & {
  teachers: {
    id: string;
    name: string;
    courseLabel: string;
    className: string | null;
  }[];
  attendanceRate: number | null;
  latestGrades: { title: string; score: number; gradedAt: string | null }[];
  dueAmount: number;
  nextMeeting: { id: string; when: string; teacherName: string } | null;
};

async function overviewsFor(children: ChildRow[]): Promise<Overview[]> {
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
    } satisfies Overview;
  });
}

/** `GET /api/v1/parent/children` — one row per linked child. */
export async function listChildOverviews(req: Request) {
  return overviewsFor(await listGuardianChildren(actorOf(req).id));
}

/** `GET /api/v1/parent/children/:id` — 403 unless the child is linked. */
export async function getChildOverview(req: Request) {
  const actor = actorOf(req);
  const id = recordIdSchema.parse(req.params.id);

  if (!(await isGuardianOf(actor.id, id))) throw notFound("Child not found");
  const child = await findUserById(id);
  if (!child || child.role !== "student") throw notFound("Child not found");

  const children = await listGuardianChildren(actor.id);
  const row = children.find((entry) => entry.id === id);
  if (!row) throw notFound("Child not found");

  const [overview] = await overviewsFor([row]);
  return overview ?? null;
}

const meetingRequestSchema = z.object({
  studentId: recordIdSchema,
  preferredDay: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional(),
});

/** `POST /api/v1/parent/meetings` — the teacher comes from the child's active enrollment. */
export async function requestMeeting(req: Request) {
  const actor = actorOf(req);
  const input = meetingRequestSchema.parse(req.body);
  await assertParentOf(actor.id, input.studentId);

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
  if (!enrollment) throw notFound("This child has no active teacher yet.");

  const slot = input.note
    ? `${input.preferredDay} - ${input.note}`
    : input.preferredDay;

  await db.transaction(async (tx) => {
    const meeting = await createMeeting(
      {
        parentId: actor.id,
        teacherId: enrollment.teacherId,
        studentId: input.studentId,
        requestedSlots: [slot],
      },
      tx,
    );
    await writeAudit(
      {
        actorId: actor.id,
        action: "requestMeeting",
        targetType: "Meeting",
        targetId: meeting.id,
        after: { studentId: input.studentId, teacherId: enrollment.teacherId },
      },
      { tx },
    );
  });
}

/** `POST /api/v1/parent/meetings/:id/reschedule` */
export async function rescheduleMeeting(req: Request) {
  const actor = actorOf(req);
  const input = z
    .object({ preferredDay: z.string().trim().min(1).max(60) })
    .parse(req.body);

  await db.transaction(async (tx) => {
    const meeting = await findMeetingById(String(req.params.id), tx);
    if (!meeting || meeting.parentId !== actor.id)
      throw notFound("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw notFound("This meeting is already closed");
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
        actorId: actor.id,
        action: "rescheduleMeeting",
        targetType: "Meeting",
        targetId: meeting.id,
        before: { state: meeting.state, slots: meeting.requestedSlots },
        after: { state: "rescheduled", slots: [input.preferredDay] },
      },
      { tx },
    );
  });
}
