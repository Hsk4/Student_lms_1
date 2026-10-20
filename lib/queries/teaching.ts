import "server-only";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Class } from "@/models/class";
import { Course } from "@/models/course";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";

const shortId = (reference: unknown) => String(reference);

async function courseLabels(courseIds: string[]) {
  await connectDB();
  const [courses, boards, levels, subjects] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).lean(),
    Board.find().select("name").lean(),
    Level.find().select("name").lean(),
    Subject.find().select("name").lean(),
  ]);
  const boardNames = new Map(
    boards.map((item) => [shortId(item._id), item.name]),
  );
  const levelNames = new Map(
    levels.map((item) => [shortId(item._id), item.name]),
  );
  const subjectNames = new Map(
    subjects.map((item) => [shortId(item._id), item.name]),
  );
  return new Map(
    courses.map((course) => [
      shortId(course._id),
      `${boardNames.get(shortId(course.boardId)) ?? "Board"} / ${levelNames.get(shortId(course.levelId)) ?? "Level"} / ${subjectNames.get(shortId(course.subjectId)) ?? "Subject"}${course.medium ? ` / ${course.medium}` : ""}`,
    ]),
  );
}

/** Teachers matching a student's board and level through their assigned courses. */
export async function listMatchingTeachers(studentId: string) {
  await connectDB();
  const student = await User.findOne({ _id: studentId, role: "student" })
    .select("student".toString())
    .lean();
  if (!student?.student?.boardId || !student.student.levelId) return [];

  const courses = await Course.find({
    boardId: student.student.boardId,
    levelId: student.student.levelId,
    active: true,
  }).lean();
  if (!courses.length) return [];
  const courseIds = courses.map((course) => course._id);
  const teachers = await User.find({
    role: "teacher",
    status: "active",
    "teacher.courseIds": { $in: courseIds },
  })
    .select("name email teacher.courseIds")
    .lean();

  const labels = await courseLabels(courseIds.map(shortId));
  return teachers.map((teacher) => ({
    id: shortId(teacher._id),
    name: teacher.name,
    courses: (teacher.teacher?.courseIds ?? [])
      .map((id: unknown) => shortId(id))
      .filter((id: string) => labels.has(id))
      .map((id: string) => ({ id, label: labels.get(id) ?? "Course" })),
  }));
}

export async function listTeacherClasses(teacherId: string) {
  await connectDB();
  const classes = await Class.find({ teacherId })
    .sort({ createdAt: -1 })
    .lean();
  const labels = await courseLabels(
    classes.map((item) => shortId(item.courseId)),
  );
  return classes.map((item) => ({
    id: shortId(item._id),
    name: item.name,
    courseId: shortId(item.courseId),
    courseLabel: labels.get(shortId(item.courseId)) ?? "Course",
    schedule: item.schedule ?? "",
    state: item.state,
  }));
}

export async function listCourseChoicesForTeacher(teacherId: string) {
  await connectDB();
  const teacher = await User.findById(teacherId)
    .select("teacher.courseIds")
    .lean();
  const ids = (teacher?.teacher?.courseIds ?? []).map((id: unknown) => shortId(id));
  const labels = await courseLabels(ids);
  return ids
    .filter((id: string) => labels.has(id))
    .map((id: string) => ({ id, label: labels.get(id) ?? "Course" }));
}
