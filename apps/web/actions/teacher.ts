"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { findActiveCourseIds } from "@/lib/queries/courses";
import { listGuardianChildren } from "@/lib/queries/guardianships";
import {
  listCourseIdsForTeacher,
  replaceTeacherCourses,
} from "@/lib/queries/teacher-courses";
import { findUserByClerkId, findUserById } from "@/lib/queries/users";
import { recordIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const teacherCoursesSchema = z.object({
  teacherId: recordIdSchema,
  courseIds: z.array(recordIdSchema).max(100),
});

/** Admin assigns courses to a teacher, with an audit record in the same transaction. */
export async function setTeacherCourses(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(["super_admin", "admin"]);
    const input = teacherCoursesSchema.parse(raw);

    await db.transaction(async (tx) => {
      const teacher = await findUserById(input.teacherId, tx);
      if (!teacher || teacher.role !== "teacher") {
        throw new Error("Teacher not found");
      }

      const unique = [...new Set(input.courseIds)];
      const activeCourses = await findActiveCourseIds(unique, tx);
      if (activeCourses.length !== unique.length) {
        throw new Error("One or more courses are missing or inactive");
      }

      const before = await listCourseIdsForTeacher(teacher.id, tx);
      await replaceTeacherCourses(teacher.id, unique, tx);

      await writeAudit(
        {
          actorId: session.actorId,
          action: "setTeacherCourses",
          targetType: "User",
          targetId: teacher.id,
          before: { courseIds: before },
          after: { courseIds: unique },
        },
        { tx },
      );
    });

    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Parent data uses the linked child relationship as the row-level filter. */
export async function listMyChildren() {
  const session = await requireRole(["parent"]);

  const parent = await findUserByClerkId(session.clerkId);
  if (!parent || parent.role !== "parent" || parent.status !== "active") {
    throw new Error("Parent account not found");
  }

  return listGuardianChildren(parent.id);
}
