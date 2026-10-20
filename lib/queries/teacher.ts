import { connectDB } from "@/lib/db";
import { Course } from "@/models/course";
import { User } from "@/models/user";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";

/** Returns the course catalog and associated active teacher ids for admin assignment UI. */
export async function getTeacherCourseAssignments() {
  await connectDB();
  const [courses, users, boards, levels, subjects] = await Promise.all([
    Course.find({ active: true }).lean(),
    User.find({ role: "teacher", status: "active" })
      .select("_id teacher.courseIds")
      .lean(),
    Board.find().select("name").lean(),
    Level.find().select("name").lean(),
    Subject.find().select("name").lean(),
  ]);

  const boardNames = new Map(
    boards.map((board) => [String(board._id), board.name]),
  );
  const levelNames = new Map(
    levels.map((level) => [String(level._id), level.name]),
  );
  const subjectNames = new Map(
    subjects.map((subject) => [String(subject._id), subject.name]),
  );
  const teacherIdsByCourse = new Map<string, string[]>();

  for (const teacher of users) {
    for (const courseId of teacher.teacher?.courseIds ?? []) {
      const courseKey = String(courseId);
      const ids = teacherIdsByCourse.get(courseKey) ?? [];
      ids.push(String(teacher._id));
      teacherIdsByCourse.set(courseKey, ids);
    }
  }

  return courses.map((course) => {
    const id = String(course._id);
    const board = boardNames.get(String(course.boardId)) ?? "Board";
    const level = levelNames.get(String(course.levelId)) ?? "Level";
    const subject = subjectNames.get(String(course.subjectId)) ?? "Subject";
    const medium = course.medium ? ` - ${course.medium}` : "";
    return {
      id,
      label: `${board} - ${level} - ${subject}${medium}`,
      teacherIds: teacherIdsByCourse.get(id) ?? [],
    };
  });
}
