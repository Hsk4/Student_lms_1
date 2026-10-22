"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB, withTransaction } from "@/lib/db";
import { User } from "@/models/user";
import { ParentInvite } from "@/models/parent-invite";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { linkParentToStudent, unlinkParentFromStudent } from "@/lib/guardians";
import { objectIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const linkSchema = z.object({
  parentId: objectIdSchema,
  studentId: objectIdSchema,
});

const unlinkSchema = linkSchema;

/**
 * Admin repair: link an existing parent account to a student. Idempotent, writes
 * both sides of the relation and an audit entry in one transaction.
 */
export async function linkGuardian(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = linkSchema.parse(raw);
    await connectDB();

    const [parent, student] = await Promise.all([
      User.findOne({ _id: input.parentId, role: "parent" })
        .select("_id status email")
        .lean(),
      User.findOne({ _id: input.studentId, role: "student" })
        .select("_id")
        .lean(),
    ]);
    if (!parent) throw new Error("Parent account not found");
    if (!student) throw new Error("Student account not found");

    await withTransaction(async (dbSession) => {
      await linkParentToStudent(
        parent._id,
        student._id,
        { markOnboarded: true },
        dbSession,
      );
      await ParentInvite.updateMany(
        {
          studentId: student._id,
          parentEmail: parent.email,
        },
        {
          $set: {
            state: "accepted",
            acceptedBy: parent._id,
            acceptedAt: new Date(),
          },
        },
        { session: dbSession },
      );
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "linkGuardian",
          targetType: "User",
          targetId: student._id,
          after: {
            parentId: String(parent._id),
            studentId: String(student._id),
          },
        },
        dbSession,
      );
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/parent-invites");
    revalidatePath("/parent");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Remove a guardian link from both sides. */
export async function unlinkGuardian(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = unlinkSchema.parse(raw);
    await connectDB();

    await withTransaction(async (dbSession) => {
      await unlinkParentFromStudent(input.parentId, input.studentId, dbSession);
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "unlinkGuardian",
          targetType: "User",
          targetId: input.studentId,
          before: { parentId: input.parentId, studentId: input.studentId },
        },
        dbSession,
      );
    });

    revalidatePath("/admin/users");
    revalidatePath("/parent");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
