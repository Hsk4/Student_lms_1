import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { courses } from "@/db/schema";
import {
  listCourseLabels,
  listTeacherCourseLinks,
} from "@/lib/queries/teacher-courses";
import type { Id } from "@/lib/types";

/**
 * Returns the course catalog and associated active teacher ids for admin
 * assignment UI. Postgres-backed.
 *
 * The Mongo version loaded every teacher and walked `teacher.courseIds[]` to
 * build the reverse map. `teacher_courses` is indexed on `course_id`, so the
 * reverse map is a single grouped read.
 */
export async function getTeacherCourseAssignments(
  conn: Tx | typeof db = db,
) {
  const [courseRows, links, labels] = await Promise.all([
    conn.select({ id: courses.id }).from(courses).where(eq(courses.active, true)),
    listTeacherCourseLinks(conn),
    listCourseLabels({ active: true }, conn),
  ]);

  const labelById = new Map(labels.map((label) => [label.id, label.label]));
  const teacherIdsByCourse = new Map<Id, Id[]>();
  for (const [teacherId, courseIds] of links) {
    for (const courseId of courseIds) {
      const current = teacherIdsByCourse.get(courseId);
      if (current) current.push(teacherId);
      else teacherIdsByCourse.set(courseId, [teacherId]);
    }
  }

  return courseRows.map((row) => ({
    id: row.id,
    label: labelById.get(row.id) ?? "Course",
    teacherIds: teacherIdsByCourse.get(row.id) ?? [],
  }));
}
