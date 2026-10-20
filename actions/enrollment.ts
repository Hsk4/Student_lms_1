"use server";

import { revalidatePath } from "next/cache";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { Course } from "@/models/course";
import { Enrollment } from "@/models/enrollment";
import { Class } from "@/models/class";
import { writeAudit } from "@/lib/audit";
import {
  requireRole,
  requireTeacherOf,
  requireEnrollmentAccess,
} from "@/lib/auth/guards";
import {
  classSchema,
  enrollmentDecisionSchema,
  enrollmentRequestSchema,
} from "@/lib/validators/teaching";
import { toState, type ActionState } from "@/lib/actions";
import { z } from "zod";

const idSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });

/** An active student asks a teacher of a course matching their board and level. */
export async function requestEnrollment(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(["student"]);
    const input = enrollmentRequestSchema.parse(raw);
    await connectDB();

    const student = await User.findOne({
      clerkId: session.clerkId,
      role: "student",
      status: "active",
    });
    if (!student) throw new Error("Student account not found");
    if (!student.onboarded)
      throw new Error("Add a parent before requesting a teacher");

    const course = await Course.findOne({
      _id: input.courseId,
      boardId: student.student?.boardId,
      levelId: student.student?.levelId,
      active: true,
    }).lean();
    if (!course)
      throw new Error("That course does not match your board and level");

    const teacher = await User.findOne({
      _id: input.teacherId,
      role: "teacher",
      status: "active",
      "teacher.courseIds": course._id,
    })
      .select("_id")
      .lean();
    if (!teacher) throw new Error("That teacher does not teach this course");

    const open = await Enrollment.findOne({
      studentId: student._id,
      state: { $in: ["requested", "active"] },
    }).lean();
    if (open)
      throw new Error("You already have an open teacher request or enrollment");

    const enrollment = await Enrollment.create({
      studentId: student._id,
      teacherId: teacher._id,
      courseId: course._id,
      state: "requested",
      requestedAt: new Date(),
    });

    await writeAudit({
      actorId: student._id,
      action: "requestEnrollment",
      targetType: "Enrollment",
      targetId: enrollment._id,
      after: { teacherId: String(teacher._id), courseId: String(course._id) },
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
    await connectDB();

    const enrollment = await Enrollment.findById(input.enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");
    if (String(enrollment.teacherId) !== actor.actorId)
      throw new Error("This request is for another teacher");
    if (enrollment.state !== "requested")
      throw new Error("This request has already been decided");
    if (input.decision === "accept" && input.classId) {
      const klass = await Class.findOne({
        _id: input.classId,
        teacherId: actor.actorId,
      }).lean();
      if (!klass) throw new Error("Class not found for this teacher");
    }

    const before = { state: enrollment.state };
    enrollment.state = input.decision === "accept" ? "active" : "declined";
    enrollment.classId =
      input.decision === "accept" ? (input.classId ?? null) : null;
    enrollment.decidedAt = new Date();
    await enrollment.save();

    await writeAudit({
      actorId: actor.actorId,
      action:
        input.decision === "accept" ? "acceptEnrollment" : "declineEnrollment",
      targetType: "Enrollment",
      targetId: enrollment._id,
      before,
      after: {
        state: enrollment.state,
        classId: enrollment.classId ? String(enrollment.classId) : null,
      },
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
    await connectDB();

    const teacher = await User.findById(actor.actorId)
      .select("teacher.courseIds")
      .lean();
    const teachesCourse = (teacher?.teacher?.courseIds ?? []).some(
      (id: unknown) => String(id) === input.courseId,
    );
    if (!teachesCourse) throw new Error("You do not teach this course");

    await withTransaction(async (dbSession) => {
      const [klass] = await Class.create(
        [
          {
            teacherId: actor.actorId,
            courseId: input.courseId,
            name: input.name,
            schedule: input.schedule,
            state: "current",
            startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
            endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
          },
        ],
        { session: dbSession },
      );

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "createClass",
          targetType: "Class",
          targetId: klass._id,
          after: { name: klass.name, courseId: input.courseId },
        },
        dbSession,
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
    await connectDB();
    const klass = await Class.findOne({
      _id: input.id,
      teacherId: actor.actorId,
    });
    if (!klass) throw new Error("Class not found");
    klass.state = "past";
    klass.endsOn = klass.endsOn ?? new Date();
    await klass.save();
    await writeAudit({
      actorId: actor.actorId,
      action: "endClass",
      targetType: "Class",
      targetId: klass._id,
      before: { state: "current" },
      after: { state: "past" },
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
  await connectDB();
  return User.findById(studentId).select("name email student").lean();
}
