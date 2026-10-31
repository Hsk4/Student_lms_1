import type { Request } from "express";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  enrollmentDecisionSchema,
  enrollmentRequestSchema,
  classSchema,
  recordIdSchema,
} from "@lms/shared";
import { db } from "@/db";
import { classes, courses, enrollments, users } from "@/db/schema";
import { conflict, forbidden, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import { assertEnrollmentAccess, assertTeacherOf } from "@/lib/ownership";
import { findCourseById } from "@/db/queries/courses";
import {
  createEnrollment,
  findEnrollmentById,
  listEnrollments,
  updateEnrollment,
} from "@/db/queries/enrollment";
import { listGuardianChildren } from "@/db/queries/guardianships";
import { listCourseIdsForTeacher } from "@/db/queries/teacher-courses";
import { listMatchingTeachers } from "@/db/queries/teaching";
import { findUserById } from "@/db/queries/users";

/**
 * Enrollments and classes: a student asks a teacher, the teacher accepts (with
 * a class or one-on-one) or declines, an admin can move a student.
 */

/** `POST /api/v1/student/enrollments` */
export async function requestEnrollment(req: Request) {
  const actor = actorOf(req);
  const input = enrollmentRequestSchema.parse(req.body);

  const student = await findUserById(actor.id);
  if (!student || student.role !== "student" || student.status !== "active") {
    throw notFound("Student account not found");
  }
  if (!student.onboarded)
    throw conflict("Add a parent before requesting a teacher");

  const course = await findCourseById(input.courseId);
  if (
    !course ||
    !course.active ||
    course.boardId !== student.student.boardId ||
    course.levelId !== student.student.levelId
  ) {
    throw conflict("That course does not match your board and level");
  }

  const teacher = await findUserById(input.teacherId);
  if (!teacher || teacher.role !== "teacher" || teacher.status !== "active") {
    throw conflict("That teacher does not teach this course");
  }
  const teacherCourses = await listCourseIdsForTeacher(teacher.id);
  if (!teacherCourses.includes(course.id)) {
    throw conflict("That teacher does not teach this course");
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
  if (open)
    throw conflict("You already have an open teacher request or enrollment");

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
}

/** `POST /api/v1/teacher/enrollments/:id/decision` */
export async function decideEnrollment(req: Request) {
  const actor = actorOf(req);
  const input = enrollmentDecisionSchema.parse({
    ...req.body,
    enrollmentId: req.params.id,
  });

  await db.transaction(async (tx) => {
    const enrollment = await findEnrollmentById(input.enrollmentId, tx);
    if (!enrollment) throw notFound("Enrollment not found");
    if (enrollment.teacherId !== actor.id)
      throw forbidden("This request is for another teacher");
    if (enrollment.state !== "requested")
      throw conflict("This request has already been decided");

    if (input.decision === "accept" && input.classId) {
      const [klass] = await tx
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(eq(classes.id, input.classId), eq(classes.teacherId, actor.id)),
        )
        .limit(1);
      if (!klass) throw notFound("Class not found for this teacher");
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
        actorId: actor.id,
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
}

/** `POST /api/v1/teacher/classes` */
export async function createClass(req: Request) {
  const actor = actorOf(req);
  const input = classSchema.parse(req.body);

  const teacherCourses = await listCourseIdsForTeacher(actor.id);
  if (!teacherCourses.includes(input.courseId))
    throw forbidden("You do not teach this course");

  await db.transaction(async (tx) => {
    const [klass] = await tx
      .insert(classes)
      .values({
        teacherId: actor.id,
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
        actorId: actor.id,
        action: "createClass",
        targetType: "Class",
        targetId: klass.id,
        after: { name: klass.name, courseId: input.courseId },
      },
      { tx },
    );
  });
}

/** `POST /api/v1/teacher/classes/:id/past` */
export async function markClassPast(req: Request) {
  const actor = actorOf(req);

  await db.transaction(async (tx) => {
    const [klass] = await tx
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.id, String(req.params.id)),
          eq(classes.teacherId, actor.id),
        ),
      )
      .limit(1);
    if (!klass) throw notFound("Class not found");

    await tx
      .update(classes)
      .set({ state: "past", endsOn: klass.endsOn ?? new Date() })
      .where(eq(classes.id, klass.id));
    await writeAudit(
      {
        actorId: actor.id,
        action: "endClass",
        targetType: "Class",
        targetId: klass.id,
        before: { state: klass.state },
        after: { state: "past" },
      },
      { tx },
    );
  });
}

/** `GET /api/v1/enrollments/:id` — student, teacher, linked parent or admin. */
export async function getEnrollment(req: Request) {
  const actor = actorOf(req);
  return assertEnrollmentAccess(actor, recordIdSchema.parse(req.params.id));
}

/** `GET /api/v1/student/teachers` — teachers matching the student's board/level. */
export async function matchingTeachers(req: Request) {
  return listMatchingTeachers(actorOf(req).id);
}

/** `GET /api/v1/admin/enrollments` with the matching teachers for each open row. */
export async function listEnrollmentsWithTeachers() {
  const open = await listEnrollments({ state: undefined });
  const rows = open.filter((item) => item.state === "requested" || item.state === "active");
  return Promise.all(
    rows.map(async (item) => ({
      ...item,
      teachers: (await listMatchingTeachers(item.studentId)).map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
      })),
    })),
  );
}

/** `GET /api/v1/teacher/students/:id` — guarded by an active enrollment. */
export async function teacherStudent(req: Request) {
  const actor = actorOf(req);
  const studentId = recordIdSchema.parse(req.params.id);
  await assertTeacherOf(actor.id, studentId);
  return findUserById(studentId);
}

/** `GET /api/v1/parent/children` — the parent's linked children only. */
export async function myChildren(req: Request) {
  return listGuardianChildren(actorOf(req).id);
}

/** `GET /api/v1/admin/enrollments` */
export async function listEnrollmentsAdmin(req: Request) {
  const state = req.query.state as
    | "requested"
    | "active"
    | "declined"
    | "cancelled"
    | "ended"
    | undefined;
  return listEnrollments({ state });
}

/* Admin reassignment */

export async function reassignStudent(req: Request) {
  const actor = actorOf(req);
  const enrollmentId = recordIdSchema.parse(req.params.id);
  const teacherId = recordIdSchema.parse(req.body?.teacherId);

  await db.transaction(async (tx) => {
    const current = await findEnrollmentById(enrollmentId, tx);
    if (!current) throw notFound("Enrollment not found");
    if (!["requested", "active"].includes(current.state)) {
      throw conflict("Only an open enrollment can be reassigned");
    }

    const teacher = await findUserById(teacherId, tx);
    if (!teacher || teacher.role !== "teacher" || teacher.status !== "active") {
      throw notFound("Teacher not found");
    }
    const teacherCourses = await listCourseIdsForTeacher(teacher.id, tx);
    if (!teacherCourses.includes(current.courseId)) {
      throw conflict("The new teacher does not teach this course");
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
    if (open) throw conflict("The student already has another open enrollment");

    await updateEnrollment(
      current.id,
      { state: "cancelled", endReason: "reassigned", decidedAt: new Date() },
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
        actorId: actor.id,
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
}

/** Cancel every open enrollment whose course no longer matches the student. */
export async function cancelMismatchedEnrollments(req: Request) {
  const actor = actorOf(req);

  const rows = await db
    .select({ id: enrollments.id, state: enrollments.state })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        inArray(enrollments.state, ["requested", "active"]),
        or(
          eq(courses.active, false),
          sql`${users.boardId} IS DISTINCT FROM ${courses.boardId}`,
          sql`${users.levelId} IS DISTINCT FROM ${courses.levelId}`,
        ),
      ),
    );

  if (rows.length === 0) return { cancelled: 0 };

  await db.transaction(async (tx) => {
    for (const enrollment of rows) {
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
          actorId: actor.id,
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

  return { cancelled: rows.length };
}


