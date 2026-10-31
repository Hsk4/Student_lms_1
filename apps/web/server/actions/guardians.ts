"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parentInvites } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  linkParentToStudent,
  unlinkParentFromStudent,
} from "@/lib/queries/guardianships";
import { findUserById } from "@/lib/queries/users";
import { recordIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const linkSchema = z.object({
  parentId: recordIdSchema,
  studentId: recordIdSchema,
});

const unlinkSchema = linkSchema;

/**
 * Admin repair: link an existing parent account to a student. Idempotent — the
 * `guardianships` composite key makes the insert a no-op on repeat — and the
 * link, the invite acceptance and the audit entry commit together.
 */
export async function linkGuardian(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = linkSchema.parse(raw);

    const [parent, student] = await Promise.all([
      findUserById(input.parentId),
      findUserById(input.studentId),
    ]);
    if (!parent || parent.role !== "parent") {
      throw new Error("Parent account not found");
    }
    if (!student || student.role !== "student") {
      throw new Error("Student account not found");
    }

    await db.transaction(async (tx) => {
      await linkParentToStudent(
        parent.id,
        student.id,
        { markOnboarded: true },
        tx,
      );
      await tx
        .update(parentInvites)
        .set({
          state: "accepted",
          acceptedBy: parent.id,
          acceptedAt: new Date(),
        })
        .where(
          and(
            eq(parentInvites.studentId, student.id),
            eq(parentInvites.parentEmail, parent.email),
          ),
        );
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "linkGuardian",
          targetType: "User",
          targetId: student.id,
          after: { parentId: parent.id, studentId: student.id },
        },
        { tx },
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

/** Remove a guardian link. One row, so there is no second side to forget. */
export async function unlinkGuardian(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["super_admin", "admin"]);
    const input = unlinkSchema.parse(raw);

    await db.transaction(async (tx) => {
      await unlinkParentFromStudent(input.parentId, input.studentId, tx);
      await writeAudit(
        {
          actorId: actor.actorId,
          action: "unlinkGuardian",
          targetType: "User",
          targetId: input.studentId,
          before: { parentId: input.parentId, studentId: input.studentId },
        },
        { tx },
      );
    });

    revalidatePath("/admin/users");
    revalidatePath("/parent");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
