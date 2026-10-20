"use server";

import { revalidatePath } from "next/cache";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { Class } from "@/models/class";
import { Enrollment } from "@/models/enrollment";
import { Assignment } from "@/models/assignment";
import { Submission } from "@/models/submission";
import { Attendance } from "@/models/attendance";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  assignmentSchema,
  submissionSchema,
  gradeSchema,
  attendanceSchema,
} from "@/lib/validators/assessment";
import { toState, type ActionState } from "@/lib/actions";

async function assertTeacherTarget(
  teacherId: string,
  classId?: string,
  enrollmentId?: string,
) {
  if (classId) {
    const klass = await Class.findOne({ _id: classId, teacherId }).lean();
    if (!klass) throw new Error("Class not found for this teacher");
    return { courseId: String(klass.courseId) };
  }
  if (enrollmentId) {
    const enrollment = await Enrollment.findOne({
      _id: enrollmentId,
      teacherId,
      state: "active",
    }).lean();
    if (!enrollment)
      throw new Error("Active enrollment not found for this teacher");
    return { courseId: String(enrollment.courseId) };
  }
  throw new Error("Choose a class or a student");
}

export async function createAssignment(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = assignmentSchema.parse(raw);
    await connectDB();
    const target = await assertTeacherTarget(
      actor.actorId,
      input.classId,
      input.enrollmentId,
    );
    if (target.courseId !== input.courseId)
      throw new Error("Assignment course does not match its target");

    await withTransaction(async (dbSession) => {
      const [assignment] = await Assignment.create(
        [
          {
            courseId: input.courseId,
            teacherId: actor.actorId,
            classId: input.classId ?? null,
            enrollmentId: input.enrollmentId ?? null,
            title: input.title,
            description: input.description,
            dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          },
        ],
        { session: dbSession },
      );
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "createAssignment",
          targetType: "Assignment",
          targetId: assignment._id,
          after: {
            title: assignment.title,
            courseId: input.courseId,
            classId: input.classId ?? null,
            enrollmentId: input.enrollmentId ?? null,
          },
        },
        dbSession,
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
    if (!input.text && !input.fileUrl)
      throw new Error("Add text or a file URL");
    await connectDB();

    const assignment = await Assignment.findById(input.assignmentId).lean();
    if (!assignment) throw new Error("Assignment not found");
    const enrollment = await Enrollment.findOne({
      studentId: actor.actorId,
      courseId: assignment.courseId,
      state: "active",
      $or: [
        { classId: assignment.classId ?? null },
        { _id: assignment.enrollmentId ?? null },
      ],
    }).lean();
    if (!enrollment)
      throw new Error("You are not enrolled for this assignment");

    const existing = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: actor.actorId,
    });
    if (existing) throw new Error("You have already submitted this assignment");
    const submission = await Submission.create({
      assignmentId: assignment._id,
      studentId: actor.actorId,
      text: input.text,
      fileUrl: input.fileUrl,
      submittedAt: new Date(),
    });
    await writeAudit({
      actorId: actor.actorId,
      action: "submitAssignment",
      targetType: "Submission",
      targetId: submission._id,
      after: { assignmentId: String(assignment._id) },
    });
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
    await connectDB();
    const submission = await Submission.findById(input.submissionId);
    if (!submission) throw new Error("Submission not found");
    const assignment = await Assignment.findOne({
      _id: submission.assignmentId,
      teacherId: actor.actorId,
    }).lean();
    if (!assignment) throw new Error("Submission is not for your assignment");
    submission.score = input.score;
    submission.feedback = input.feedback;
    submission.gradedBy = (
      await User.findById(actor.actorId).select("_id").lean()
    )?._id;
    submission.gradedAt = new Date();
    await submission.save();
    await writeAudit({
      actorId: actor.actorId,
      action: "gradeSubmission",
      targetType: "Submission",
      targetId: submission._id,
      before: { score: null },
      after: { score: input.score },
    });
    revalidatePath("/student");
    revalidatePath("/teacher");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function saveAttendance(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = attendanceSchema.parse(raw);
    if (Boolean(input.classId) === Boolean(input.enrollmentId))
      throw new Error("Choose a class or one student");
    await connectDB();
    await assertTeacherTarget(actor.actorId, input.classId, input.enrollmentId);

    const records = input.studentIds.map((studentId) => ({
      studentId,
      present: input.presentStudentIds.includes(studentId),
    }));
    if (!records.length) throw new Error("No students to record");
    await Attendance.create({
      classId: input.classId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      date: new Date(input.date),
      records,
    });
    await writeAudit({
      actorId: actor.actorId,
      action: "saveAttendance",
      targetType: "Attendance",
      targetId: null,
      after: {
        classId: input.classId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        date: input.date,
        count: records.length,
      },
    });
    revalidatePath("/teacher");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
