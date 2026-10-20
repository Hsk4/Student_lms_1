"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { Course } from "@/models/course";
import { Enrollment } from "@/models/enrollment";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { objectIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const reassignSchema = z.object({
  enrollmentId: objectIdSchema,
  teacherId: objectIdSchema,
});

/** One transaction: cancel the old enrollment, create the new one, audit both. */
export async function reassignStudent(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = reassignSchema.parse(raw);
    await connectDB();

    await withTransaction(async (dbSession) => {
      const current = await Enrollment.findById(input.enrollmentId).session(
        dbSession,
      );
      if (!current) throw new Error("Enrollment not found");
      if (!["requested", "active"].includes(current.state))
        throw new Error("Only an open enrollment can be reassigned");

      const teacher = await User.findOne({
        _id: input.teacherId,
        role: "teacher",
        status: "active",
      })
        .select("_id teacher.courseIds")
        .session(dbSession)
        .lean();
      if (!teacher) throw new Error("Teacher not found");
      const teachesCourse = (teacher.teacher?.courseIds ?? []).some(
        (id: unknown) => String(id) === String(current.courseId),
      );
      if (!teachesCourse)
        throw new Error("The new teacher does not teach this course");

      const open = await Enrollment.findOne({
        _id: { $ne: current._id },
        studentId: current.studentId,
        state: { $in: ["requested", "active"] },
      })
        .session(dbSession)
        .lean();
      if (open)
        throw new Error("The student already has another open enrollment");

      const before = {
        teacherId: String(current.teacherId),
        state: current.state,
      };
      current.state = "cancelled";
      current.endReason = "reassigned";
      current.decidedAt = new Date();
      await current.save({ session: dbSession });

      const [next] = await Enrollment.create(
        [
          {
            studentId: current.studentId,
            teacherId: teacher._id,
            courseId: current.courseId,
            state: "active",
            requestedAt: new Date(),
            decidedAt: new Date(),
          },
        ],
        { session: dbSession },
      );

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "reassignStudent",
          targetType: "Enrollment",
          targetId: current._id,
          before,
          after: {
            teacherId: String(teacher._id),
            state: "active",
            newEnrollmentId: String(next._id),
          },
        },
        dbSession,
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

/** Cancel every open enrollment that no longer matches the course row. */
export async function cancelMismatchedEnrollments() {
  const actor = await requireRole(["super_admin", "admin"]);
  await connectDB();
  const courses = await Course.find({ active: true })
    .select("_id boardId levelId")
    .lean();
  const byId = new Map(courses.map((course) => [String(course._id), course]));
  const enrollments = await Enrollment.find({
    state: { $in: ["requested", "active"] },
  }).lean();
  const studentIds = [
    ...new Set(enrollments.map((item) => String(item.studentId))),
  ];
  const students = await User.find({ _id: { $in: studentIds } })
    .select("student.boardId student.levelId")
    .lean();
  const studentsById = new Map(
    students.map((student) => [String(student._id), student]),
  );
  const mismatched = enrollments.filter((enrollment) => {
    const course = byId.get(String(enrollment.courseId));
    const student = studentsById.get(String(enrollment.studentId));
    return (
      !course ||
      !student ||
      String(course.boardId) !== String(student.student?.boardId) ||
      String(course.levelId) !== String(student.student?.levelId)
    );
  });
  if (!mismatched.length) return { ok: true, cancelled: 0 };

  await withTransaction(async (dbSession) => {
    for (const enrollment of mismatched) {
      await Enrollment.updateOne(
        { _id: enrollment._id },
        {
          $set: {
            state: "cancelled",
            endReason: "catalog mismatch",
            decidedAt: new Date(),
          },
        },
        { session: dbSession },
      );
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "cancelMismatchedEnrollment",
          targetType: "Enrollment",
          targetId: enrollment._id,
          before: { state: enrollment.state },
          after: { state: "cancelled", reason: "catalog mismatch" },
        },
        dbSession,
      );
    }
  });
  return { ok: true, cancelled: mismatched.length };
}
