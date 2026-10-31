"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { courses, enrollments, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  createEnrollment,
  findEnrollmentById,
  updateEnrollment,
} from "@/lib/queries/enrollment";
import { listCourseIdsForTeacher } from "@/lib/queries/teacher-courses";
import { findUserById } from "@/lib/queries/users";
import { recordIdSchema } from "@lms/shared";
import { toState, type ActionState } from "@/lib/actions";

const reassignSchema = z.object({
  enrollmentId: recordIdSchema,
  teacherId: recordIdSchema,
});

/** One transaction: cancel the old enrollment, create the new one, audit both. */
export async function reassignStudent(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = reassignSchema.parse(raw);

    await db.transaction(async (tx) => {
      const current = await findEnrollmentById(input.enrollmentId, tx);
      if (!current) throw new Error("Enrollment not found");
      if (!["requested", "active"].includes(current.state)) {
        throw new Error("Only an open enrollment can be reassigned");
      }

      const teacher = await findUserById(input.teacherId, tx);
      if (
        !teacher ||
        teacher.role !== "teacher" ||
        teacher.status !== "active"
      ) {
        throw new Error("Teacher not found");
      }
      const teacherCourses = await listCourseIdsForTeacher(teacher.id, tx);
      if (!teacherCourses.includes(current.courseId)) {
        throw new Error("The new teacher does not teach this course");
      }

      const [open] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            ne(enrollments.id, current.id),
            eq(enrollments.studentId, current.studentId),
            inArray(enrollments.state, ["requested", "active"]),
          ),
        )
        .limit(1);
      if (open) {
        throw new Error("The student already has another open enrollment");
      }

      await updateEnrollment(
        current.id,
        {
          state: "cancelled",
          endReason: "reassigned",
          decidedAt: new Date(),
        },
        tx,
      );

      const decidedAt = new Date();
      const next = await createEnrollment(
        {
          studentId: current.studentId,
          teacherId: teacher.id,
          courseId: current.courseId,
          state: "active",
        },
        tx,
      );
      await updateEnrollment(next.id, { decidedAt }, tx);

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "reassignStudent",
          targetType: "Enrollment",
          targetId: current.id,
          before: { teacherId: current.teacherId, state: current.state },
          after: {
            teacherId: teacher.id,
            state: "active",
            newEnrollmentId: next.id,
          },
        },
        { tx },
      );
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/teacher");
    revalidatePath("/student");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Cancel every open enrollment that no longer matches the course row.
 *
 * The mismatch test is a join condition, so it runs in SQL: an enrollment is
 * mismatched when its course is missing/inactive, or the course's board/level
 * differs from the student's.
 */
export async function cancelMismatchedEnrollments() {
  const actor = await requireRole(["super_admin", "admin"]);

  const mismatched = await db
    .select({ id: enrollments.id, state: enrollments.state })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        inArray(enrollments.state, ["requested", "active"]),
        or(
          // The course was deactivated or moved under the catalog.
          eq(courses.active, false),
          // The student's board or level no longer matches the course.
          // `IS DISTINCT FROM` rather than `<>` because the student's columns
          // are nullable: a student with no board is a mismatch, not a NULL
          // comparison that silently drops the row.
          sql`${users.boardId} IS DISTINCT FROM ${courses.boardId}`,
          sql`${users.levelId} IS DISTINCT FROM ${courses.levelId}`,
        ),
      ),
    );
  const openRows = mismatched;

  if (openRows.length === 0) return { ok: true, cancelled: 0 };

  await db.transaction(async (tx) => {
    for (const enrollment of openRows) {
      await updateEnrollment(
        enrollment.id,
        {
          state: "cancelled",
          endReason: "catalog mismatch",
          decidedAt: new Date(),
        },
        tx,
      );
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "cancelMismatchedEnrollment",
          targetType: "Enrollment",
          targetId: enrollment.id,
          before: { state: enrollment.state },
          after: { state: "cancelled", reason: "catalog mismatch" },
        },
        { tx },
      );
    }
  });

  return { ok: true, cancelled: openRows.length };
}
