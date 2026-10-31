"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assignments,
  attendanceRecords,
  attendanceSessions,
  classes,
  enrollments,
  submissions,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  findAssignmentById,
  findSubmissionFor,
} from "@/lib/queries/assessment";
import { isUniqueViolation } from "@/db/errors";
import {
  assignmentSchema,
  submissionSchema,
  gradeSchema,
  attendanceSchema,
} from "@/lib/validators/assessment";
import { toState, type ActionState } from "@/lib/actions";
import type { Id } from "@/lib/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolves the course behind a class or a one-on-one enrollment, and proves the
 * teacher owns it. Runs against the same transaction as the write, so the check
 * cannot pass on a row another transaction is about to change.
 */
async function assertTeacherTarget(
  teacherId: Id,
  classId: string | undefined,
  enrollmentId: string | undefined,
  tx: Tx | typeof db = db,
) {
  if (classId) {
    const [klass] = await tx
      .select({ courseId: classes.courseId })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .limit(1);
    if (!klass) throw new Error("Class not found for this teacher");
    return { courseId: klass.courseId as string };
  }
  if (enrollmentId) {
    const [enrollment] = await tx
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.teacherId, teacherId),
          eq(enrollments.state, "active"),
        ),
      )
      .limit(1);
    if (!enrollment) {
      throw new Error("Active enrollment not found for this teacher");
    }
    return { courseId: enrollment.courseId as string };
  }
  throw new Error("Choose a class or a student");
}

export async function createAssignment(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = assignmentSchema.parse(raw);

    await db.transaction(async (tx) => {
      const target = await assertTeacherTarget(
        actor.actorId,
        input.classId,
        input.enrollmentId,
        tx,
      );
      if (target.courseId !== input.courseId) {
        throw new Error("Assignment course does not match its target");
      }

      const [assignment] = await tx
        .insert(assignments)
        .values({
          courseId: input.courseId,
          teacherId: actor.actorId,
          classId: input.classId ?? null,
          enrollmentId: input.enrollmentId ?? null,
          title: input.title,
          description: input.description ?? null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        })
        .returning();

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "createAssignment",
          targetType: "Assignment",
          targetId: assignment.id,
          after: {
            title: assignment.title,
            courseId: input.courseId,
            classId: input.classId ?? null,
            enrollmentId: input.enrollmentId ?? null,
          },
        },
        { tx },
      );
    });

    revalidatePath("/teacher");
    revalidatePath("/student");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** A student may submit only when an active enrollment exists for the assignment's course. */
export async function submitAssignment(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["student"]);
    const input = submissionSchema.parse(raw);
    if (!input.text && !input.fileUrl) {
      throw new Error("Add text or a file URL");
    }

    const assignment = await findAssignmentById(input.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    // The enrollment must match the assignment's target: the same class, or the
    // same one-on-one enrollment for this student.
    const targetClauses = [
      assignment.classId
        ? eq(enrollments.classId, assignment.classId)
        : undefined,
      assignment.enrollmentId
        ? eq(enrollments.id, assignment.enrollmentId)
        : undefined,
    ].filter(
      (clause): clause is NonNullable<typeof clause> => clause !== undefined,
    );

    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, actor.actorId),
          eq(enrollments.courseId, assignment.courseId),
          eq(enrollments.state, "active"),
          or(...targetClauses),
        ),
      )
      .limit(1);
    if (!enrollment)
      throw new Error("You are not enrolled for this assignment");

    try {
      await db.transaction(async (tx) => {
        const [submission] = await tx
          .insert(submissions)
          .values({
            assignmentId: assignment.id,
            studentId: actor.actorId,
            text: input.text ?? null,
            fileUrl: input.fileUrl ?? null,
            submittedAt: new Date(),
          })
          .returning();

        await writeAudit(
          {
            actorId: actor.actorId,
            action: "submitAssignment",
            targetType: "Submission",
            targetId: submission.id,
            after: { assignmentId: assignment.id },
          },
          { tx },
        );
      });
    } catch (error) {
      // Was a read-then-write check in Mongo; the unique index on
      // (assignment_id, student_id) now settles it. Two taps in two tabs used to
      // race past the check — now the second one loses here.
      if (isUniqueViolation(error, "submissions_assignment_student_unique")) {
        throw new Error("You have already submitted this assignment");
      }
      throw error;
    }

    revalidatePath("/student");
    revalidatePath("/teacher");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function gradeSubmission(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = gradeSchema.parse(raw);

    await db.transaction(async (tx) => {
      const [submission] = await tx
        .select()
        .from(submissions)
        .where(eq(submissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new Error("Submission not found");

      const [assignment] = await tx
        .select({ id: assignments.id })
        .from(assignments)
        .where(
          and(
            eq(assignments.id, submission.assignmentId),
            eq(assignments.teacherId, actor.actorId),
          ),
        )
        .limit(1);
      if (!assignment) throw new Error("Submission is not for your assignment");

      await tx
        .update(submissions)
        .set({
          score: input.score,
          feedback: input.feedback ?? null,
          gradedBy: actor.actorId,
          gradedAt: new Date(),
        })
        .where(eq(submissions.id, submission.id));

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "gradeSubmission",
          targetType: "Submission",
          targetId: submission.id,
          before: { score: submission.score },
          after: { score: input.score },
        },
        { tx },
      );
    });

    revalidatePath("/student");
    revalidatePath("/teacher");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Attendance is two tables: `attendance_sessions` (one row per class/enrollment
 * per day) then `attendance_records` (one row per student). The session row is
 * written first because the records reference it; both commit together, so a
 * failure cannot leave a session with no records.
 */
export async function saveAttendance(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = attendanceSchema.parse(raw);
    if (Boolean(input.classId) === Boolean(input.enrollmentId)) {
      throw new Error("Choose a class or one student");
    }

    const records = input.studentIds.map((studentId) => ({
      studentId,
      present: input.presentStudentIds.includes(studentId),
    }));
    if (records.length === 0) throw new Error("No students to record");

    // `date` is a Postgres `date`, so the value must be YYYY-MM-DD.
    const isoDate = new Date(input.date).toISOString().slice(0, 10);

    await db.transaction(async (tx) => {
      await assertTeacherTarget(
        actor.actorId,
        input.classId,
        input.enrollmentId,
        tx,
      );

      const [session] = await tx
        .insert(attendanceSessions)
        .values({
          classId: input.classId ?? null,
          enrollmentId: input.enrollmentId ?? null,
          date: isoDate,
        })
        .returning();

      await tx
        .insert(attendanceRecords)
        .values(
          records.map((record) => ({
            sessionId: session.id,
            studentId: record.studentId,
            present: record.present,
          })),
        )
        .onConflictDoNothing();

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "saveAttendance",
          targetType: "Attendance",
          targetId: session.id,
          after: {
            classId: input.classId ?? null,
            enrollmentId: input.enrollmentId ?? null,
            date: isoDate,
            count: records.length,
          },
        },
        { tx },
      );
    });

    revalidatePath("/teacher");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Kept for the student panel: the submission for one assignment, if any. */
export async function getMySubmission(assignmentId: string, studentId: string) {
  return findSubmissionFor(assignmentId, studentId);
}
