"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  requireRole,
  requireTeacherOf,
  requireEnrollmentAccess,
} from "@/lib/auth/guards";
import { findCourseById } from "@/lib/queries/courses";
import {
  createEnrollment,
  findEnrollmentById,
  updateEnrollment,
} from "@/lib/queries/enrollment";
import { listCourseIdsForTeacher } from "@/lib/queries/teacher-courses";
import { findUserByClerkId, findUserById } from "@/lib/queries/users";
import { recordIdSchema } from "@/lib/validators/common";
import {
  classSchema,
  enrollmentDecisionSchema,
  enrollmentRequestSchema,
} from "@/lib/validators/teaching";
import { toState, type ActionState } from "@/lib/actions";

const idSchema = z.object({ id: recordIdSchema });

/** An active student asks a teacher of a course matching their board and level. */
export async function requestEnrollment(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(["student"]);
    const input = enrollmentRequestSchema.parse(raw);

    const student = await findUserByClerkId(session.clerkId);
    if (!student || student.role !== "student" || student.status !== "active") {
      throw new Error("Student account not found");
    }
    if (!student.onboarded) {
      throw new Error("Add a parent before requesting a teacher");
    }

    const course = await findCourseById(input.courseId);
    if (
      !course ||
      !course.active ||
      course.boardId !== student.student.boardId ||
      course.levelId !== student.student.levelId
    ) {
      throw new Error("That course does not match your board and level");
    }

    const teacher = await findUserById(input.teacherId);
    if (!teacher || teacher.role !== "teacher" || teacher.status !== "active") {
      throw new Error("That teacher does not teach this course");
    }
    const teacherCourses = await listCourseIdsForTeacher(teacher.id);
    if (!teacherCourses.includes(course.id)) {
      throw new Error("That teacher does not teach this course");
    }

    const [open] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, student.id),
          inArray(enrollments.state, ["requested", "active"]),
        ),
      )
      .limit(1);
    if (open) {
      throw new Error("You already have an open teacher request or enrollment");
    }

    await db.transaction(async (tx) => {
      const enrollment = await createEnrollment(
        {
          studentId: student.id,
          teacherId: teacher.id,
          courseId: course.id,
          state: "requested",
        },
        tx,
      );

      await writeAudit(
        {
          actorId: student.id,
          action: "requestEnrollment",
          targetType: "Enrollment",
          targetId: enrollment.id,
          after: { teacherId: teacher.id, courseId: course.id },
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

/** Teacher accepts as a class or one-on-one, or declines. */
export async function decideEnrollment(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = enrollmentDecisionSchema.parse(raw);

    await db.transaction(async (tx) => {
      const enrollment = await findEnrollmentById(input.enrollmentId, tx);
      if (!enrollment) throw new Error("Enrollment not found");
      if (enrollment.teacherId !== actor.actorId) {
        throw new Error("This request is for another teacher");
      }
      if (enrollment.state !== "requested") {
        throw new Error("This request has already been decided");
      }

      if (input.decision === "accept" && input.classId) {
        const [klass] = await tx
          .select({ id: classes.id })
          .from(classes)
          .where(
            and(
              eq(classes.id, input.classId),
              eq(classes.teacherId, actor.actorId),
            ),
          )
          .limit(1);
        if (!klass) throw new Error("Class not found for this teacher");
      }

      const nextState = input.decision === "accept" ? "active" : "declined";
      const classId =
        input.decision === "accept" ? (input.classId ?? null) : null;

      await updateEnrollment(
        enrollment.id,
        { state: nextState, classId, decidedAt: new Date() },
        tx,
      );

      await writeAudit(
        {
          actorId: actor.actorId,
          action:
            input.decision === "accept"
              ? "acceptEnrollment"
              : "declineEnrollment",
          targetType: "Enrollment",
          targetId: enrollment.id,
          before: { state: enrollment.state },
          after: { state: nextState, classId },
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

/** Teacher creates a class for one of the courses they teach. */
export async function createClass(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = classSchema.parse(raw);

    const teacherCourses = await listCourseIdsForTeacher(actor.actorId);
    if (!teacherCourses.includes(input.courseId)) {
      throw new Error("You do not teach this course");
    }

    await db.transaction(async (tx) => {
      const [klass] = await tx
        .insert(classes)
        .values({
          teacherId: actor.actorId,
          courseId: input.courseId,
          name: input.name,
          schedule: input.schedule ?? null,
          state: "current",
          startsOn: input.startsOn ? new Date(input.startsOn) : null,
          endsOn: input.endsOn ? new Date(input.endsOn) : null,
        })
        .returning();

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "createClass",
          targetType: "Class",
          targetId: klass.id,
          after: { name: klass.name, courseId: input.courseId },
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

export async function markClassPast(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = idSchema.parse(raw);

    await db.transaction(async (tx) => {
      const [klass] = await tx
        .select()
        .from(classes)
        .where(
          and(eq(classes.id, input.id), eq(classes.teacherId, actor.actorId)),
        )
        .limit(1);
      if (!klass) throw new Error("Class not found");

      await tx
        .update(classes)
        .set({ state: "past", endsOn: klass.endsOn ?? new Date() })
        .where(eq(classes.id, klass.id));

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "endClass",
          targetType: "Class",
          targetId: klass.id,
          before: { state: klass.state },
          after: { state: "past" },
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

/** Student confirms they are linked to the teacher before reading their own records. */
export async function getMyEnrollment(studentId: string) {
  const { session } = await requireEnrollmentAccess(studentId);
  return session;
}

/** Teacher reads one student only after an active enrollment exists. */
export async function getStudentForTeacher(clerkId: string, studentId: string) {
  await requireTeacherOf(clerkId, studentId);
  return findUserById(recordIdSchema.parse(studentId));
}
