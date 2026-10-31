import type { Request } from "express";
import { and, eq, or } from "drizzle-orm";
import {
  assignmentSchema,
  attendanceSchema,
  gradeSchema,
  submissionSchema,
} from "@lms/shared";
import { db } from "@/db";
import {
  assignments,
  attendanceRecords,
  attendanceSessions,
  classes,
  enrollments,
  submissions,
} from "@/db/schema";
import { isUniqueViolation } from "@/db/errors";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import { findAssignmentById } from "@/db/queries/assessment";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolves the course behind a class or a one-on-one enrollment, and proves the
 * teacher owns it, inside the same transaction as the write.
 */
async function assertTeacherTarget(
  teacherId: string,
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
    if (!klass) throw notFound("Class not found for this teacher");
    return { courseId: klass.courseId };
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
    if (!enrollment)
      throw notFound("Active enrollment not found for this teacher");
    return { courseId: enrollment.courseId };
  }
  throw conflict("Choose a class or a student");
}

/** `POST /api/v1/teacher/assignments` */
export async function createAssignment(req: Request) {
  const actor = actorOf(req);
  const input = assignmentSchema.parse(req.body);

  await db.transaction(async (tx) => {
    const target = await assertTeacherTarget(
      actor.id,
      input.classId,
      input.enrollmentId,
      tx,
    );
    if (target.courseId !== input.courseId) {
      throw conflict("Assignment course does not match its target");
    }

    const [assignment] = await tx
      .insert(assignments)
      .values({
        courseId: input.courseId,
        teacherId: actor.id,
        classId: input.classId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      })
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
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
}

/** `POST /api/v1/student/submissions` — only with an active enrollment for the assignment. */
export async function submitAssignment(req: Request) {
  const actor = actorOf(req);
  const input = submissionSchema.parse(req.body);
  if (!input.text && !input.fileUrl) throw conflict("Add text or a file URL");

  const assignment = await findAssignmentById(input.assignmentId);
  if (!assignment) throw notFound("Assignment not found");

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
        eq(enrollments.studentId, actor.id),
        eq(enrollments.courseId, assignment.courseId),
        eq(enrollments.state, "active"),
        or(...targetClauses),
      ),
    )
    .limit(1);
  if (!enrollment) throw forbidden("You are not enrolled for this assignment");

  try {
    await db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(submissions)
        .values({
          assignmentId: assignment.id,
          studentId: actor.id,
          text: input.text ?? null,
          fileUrl: input.fileUrl ?? null,
          submittedAt: new Date(),
        })
        .returning();

      await writeAudit(
        {
          actorId: actor.id,
          action: "submitAssignment",
          targetType: "Submission",
          targetId: submission.id,
          after: { assignmentId: assignment.id },
        },
        { tx },
      );
    });
  } catch (error) {
    // The unique index on (assignment_id, student_id) settles a double submit.
    if (isUniqueViolation(error, "submissions_assignment_student_unique")) {
      throw conflict("You have already submitted this assignment");
    }
    throw error;
  }
}

/** `POST /api/v1/teacher/submissions/:id/grade` */
export async function gradeSubmission(req: Request) {
  const actor = actorOf(req);
  const input = gradeSchema.parse({ ...req.body, submissionId: req.params.id });

  await db.transaction(async (tx) => {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1);
    if (!submission) throw notFound("Submission not found");

    const [assignment] = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, submission.assignmentId),
          eq(assignments.teacherId, actor.id),
        ),
      )
      .limit(1);
    if (!assignment) throw forbidden("Submission is not for your assignment");

    await tx
      .update(submissions)
      .set({
        score: input.score,
        feedback: input.feedback ?? null,
        gradedBy: actor.id,
        gradedAt: new Date(),
      })
      .where(eq(submissions.id, submission.id));

    await writeAudit(
      {
        actorId: actor.id,
        action: "gradeSubmission",
        targetType: "Submission",
        targetId: submission.id,
        before: { score: submission.score },
        after: { score: input.score },
      },
      { tx },
    );
  });
}

/**
 * `POST /api/v1/teacher/attendance` — two tables, one transaction: the session
 * row first (records reference it), then one record per student.
 */
export async function saveAttendance(req: Request) {
  const actor = actorOf(req);
  const input = attendanceSchema.parse(req.body);
  if (Boolean(input.classId) === Boolean(input.enrollmentId)) {
    throw badRequest("Choose a class or one student");
  }

  const records = input.studentIds.map((studentId) => ({
    studentId,
    present: input.presentStudentIds.includes(studentId),
  }));
  if (records.length === 0) throw conflict("No students to record");

  // `date` is a Postgres `date`, so the value must be YYYY-MM-DD.
  const isoDate = new Date(input.date).toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await assertTeacherTarget(actor.id, input.classId, input.enrollmentId, tx);

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
        actorId: actor.id,
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
}
