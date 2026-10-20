'use server';

import { z } from 'zod';
import { connectDB, withTransaction } from '@/lib/db';
import { User } from '@/models/user';
import { Course } from '@/models/course';
import { writeAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/guards';
import { objectIdSchema } from '@/lib/validators/common';
import { toState, type ActionState } from '@/lib/actions';

const teacherCoursesSchema = z.object({
  teacherId: objectIdSchema,
  courseIds: z.array(objectIdSchema).max(100),
});

/** Admin assigns courses to a teacher, with an audit record in the same transaction. */
export async function setTeacherCourses(raw: unknown): Promise<ActionState> {
  try {
    const session = await requireRole(['super_admin', 'admin']);
    const input = teacherCoursesSchema.parse(raw);
    await connectDB();

    await withTransaction(async (dbSession) => {
      const teacher = await User.findById(input.teacherId).session(dbSession);
      if (!teacher || teacher.role !== 'teacher') throw new Error('Teacher not found');

      const courses = await Course.find({ _id: { $in: input.courseIds }, active: true })
        .select('_id')
        .session(dbSession)
        .lean();
      if (courses.length !== input.courseIds.length) {
        throw new Error('One or more courses are missing or inactive');
      }

      const before = (teacher.teacher?.courseIds ?? []).map(String);
      teacher.set('teacher.courseIds', input.courseIds);
      await teacher.save({ session: dbSession });

      await writeAudit(
        {
          actorId: session.actorId,
          action: 'setTeacherCourses',
          targetType: 'User',
          targetId: teacher._id,
          before: { courseIds: before },
          after: { courseIds: input.courseIds },
        },
        dbSession
      );
    });

    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Parent data uses the linked child relationship as the row-level filter. */
export async function listMyChildren() {
  const session = await requireRole(['parent']);
  await connectDB();

  const parent = await User.findOne({ clerkId: session.clerkId, role: 'parent', status: 'active' })
    .select('_id')
    .lean();
  if (!parent) throw new Error('Parent account not found');

  return User.find({ 'student.guardianIds': parent._id, role: 'student', status: 'active' })
    .select('name student.boardId student.levelId')
    .lean();
}
