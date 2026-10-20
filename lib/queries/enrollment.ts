import "server-only";
import { connectDB } from "@/lib/db";
import { Enrollment } from "@/models/enrollment";
import { Class } from "@/models/class";
import { Course } from "@/models/course";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";
import { User } from "@/models/user";

const shortId = (reference: unknown) => String(reference);

export type EnrollmentView = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  teacherId: string;
  teacherName: string;
  courseId: string;
  courseLabel: string;
  classId: string | null;
  className: string | null;
  state: string;
  requestedAt: string;
  decidedAt: string | null;
};

async function labelLookups() {
  const [boards, levels, subjects] = await Promise.all([
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
  return (
    course:
      | {
          boardId: unknown;
          levelId: unknown;
          subjectId: unknown;
          medium?: string;
        }
      | undefined,
  ) => {
    if (!course) return "Course";
    const board = boardNames.get(shortId(course.boardId)) ?? "Board";
    const level = levelNames.get(shortId(course.levelId)) ?? "Level";
    const subject = subjectNames.get(shortId(course.subjectId)) ?? "Subject";
    return `${board} / ${level} / ${subject}${course.medium ? ` / ${course.medium}` : ""}`;
  };
}

export async function listEnrollments(filter?: {
  teacherId?: string;
  studentId?: string;
  state?: string;
}) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (filter?.teacherId) query.teacherId = filter.teacherId;
  if (filter?.studentId) query.studentId = filter.studentId;
  if (filter?.state) query.state = filter.state;
  const enrollments = await Enrollment.find(query)
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  if (!enrollments.length) return [] as EnrollmentView[];

  const studentIds = [
    ...new Set(enrollments.map((item) => shortId(item.studentId))),
  ];
  const teacherIds = [
    ...new Set(enrollments.map((item) => shortId(item.teacherId))),
  ];
  const courseIds = [
    ...new Set(enrollments.map((item) => shortId(item.courseId))),
  ];
  const classIds = enrollments
    .map((item) => item.classId)
    .filter(Boolean)
    .map(shortId);
  const [students, teachers, courses, classes, courseLabel] = await Promise.all(
    [
      User.find({ _id: { $in: studentIds } })
        .select("name email")
        .lean(),
      User.find({ _id: { $in: teacherIds } })
        .select("name")
        .lean(),
      Course.find({ _id: { $in: courseIds } }).lean(),
      Class.find({ _id: { $in: classIds } })
        .select("name")
        .lean(),
      labelLookups(),
    ],
  );
  const studentById = new Map(
    students.map((item) => [shortId(item._id), item]),
  );
  const teacherById = new Map(
    teachers.map((item) => [shortId(item._id), item]),
  );
  const courseById = new Map(courses.map((item) => [shortId(item._id), item]));
  const classById = new Map(classes.map((item) => [shortId(item._id), item]));

  return enrollments.map((item) => {
    const student = studentById.get(shortId(item.studentId));
    const teacher = teacherById.get(shortId(item.teacherId));
    const klass = item.classId
      ? classById.get(shortId(item.classId))
      : undefined;
    return {
      id: shortId(item._id),
      studentId: shortId(item.studentId),
      studentName: student?.name ?? "Student",
      studentEmail: student?.email ?? "",
      teacherId: shortId(item.teacherId),
      teacherName: teacher?.name ?? "Teacher",
      courseId: shortId(item.courseId),
      courseLabel: courseLabel(courseById.get(shortId(item.courseId))),
      classId: item.classId ? shortId(item.classId) : null,
      className: klass?.name ?? null,
      state: item.state,
      requestedAt: new Date(item.requestedAt).toISOString(),
      decidedAt: item.decidedAt ? new Date(item.decidedAt).toISOString() : null,
    };
  });
}
