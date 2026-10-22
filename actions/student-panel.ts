"use server";

import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Enrollment } from "@/models/enrollment";
import { Course } from "@/models/course";
import { Board } from "@/models/board";
import { Level } from "@/models/level";
import { Subject } from "@/models/subject";
import { Assignment } from "@/models/assignment";
import { Submission } from "@/models/submission";
import { Attendance } from "@/models/attendance";
import { Book } from "@/models/book";
import { Material } from "@/models/material";
import {
  listStudentAssignments,
  type StudentAssignmentRow,
} from "@/lib/queries/assessment";

const shortId = (reference: unknown) => String(reference);

/** The signed-in student's own record. Every read below scopes to this id. */
async function requireStudentActor() {
  const session = await requireRole(["student"]);
  return { actorId: session.actorId, session };
}

export type StudentCourse = {
  enrollmentId: string;
  state: string;
  courseId: string;
  courseLabel: string;
  medium: string | null;
  teacherName: string;
  className: string | null;
  schedule: string | null;
  requestedAt: string;
  decidedAt: string | null;
};

export async function listMyCourses(): Promise<StudentCourse[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const enrollments = await Enrollment.find({ studentId: actorId })
    .populate("teacherId", "name")
    .populate("classId", "name schedule")
    .sort({ createdAt: -1 })
    .lean();
  if (!enrollments.length) return [];

  const courseIds = enrollments.map((item) => shortId(item.courseId));
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
  const courseById = new Map(courses.map((item) => [shortId(item._id), item]));

  return enrollments.map((item) => {
    const course = courseById.get(shortId(item.courseId));
    const klass = item.classId as unknown as {
      name?: string;
      schedule?: string;
    } | null;
    return {
      enrollmentId: shortId(item._id),
      state: item.state,
      courseId: shortId(item.courseId),
      courseLabel: course
        ? `${boardNames.get(shortId(course.boardId)) ?? "Board"} / ${levelNames.get(shortId(course.levelId)) ?? "Level"} / ${subjectNames.get(shortId(course.subjectId)) ?? "Subject"}`
        : "Course",
      medium: course?.medium ?? null,
      teacherName:
        (item.teacherId as unknown as { name?: string } | null)?.name ??
        "Teacher",
      className: klass?.name ?? null,
      schedule: klass?.schedule ?? null,
      requestedAt: new Date(item.requestedAt).toISOString(),
      decidedAt: item.decidedAt ? new Date(item.decidedAt).toISOString() : null,
    };
  });
}

/** Assignments across every active enrollment. */
export async function listMyAssignments(): Promise<StudentAssignmentRow[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const enrollments = await Enrollment.find({
    studentId: actorId,
    state: "active",
  })
    .select("courseId")
    .lean();
  const courseIds = [
    ...new Set(enrollments.map((item) => shortId(item.courseId))),
  ];
  if (!courseIds.length) return [];

  const rows = await Promise.all(
    courseIds.map((courseId) => listStudentAssignments(actorId, courseId)),
  );
  return rows.flat().sort((a, b) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export type StudentAttendanceRow = {
  id: string;
  date: string;
  present: boolean;
  context: string;
};

/** Attendance entries that mention this student. */
export async function listMyAttendance(): Promise<StudentAttendanceRow[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const enrollments = await Enrollment.find({ studentId: actorId })
    .populate("classId", "name")
    .lean();
  const classIds = enrollments.map((item) => item.classId).filter(Boolean);
  const enrollmentIds = enrollments.map((item) => item._id);

  const rows = await Attendance.find({
    $or: [
      { classId: { $in: classIds } },
      { enrollmentId: { $in: enrollmentIds } },
    ],
  })
    .sort({ date: -1 })
    .limit(60)
    .lean();

  const classById = new Map(
    enrollments
      .filter((item) => item.classId)
      .map((item) => [
        shortId(item.classId),
        (item.classId as unknown as { name?: string } | null)?.name ?? "Class",
      ]),
  );

  return rows
    .map((row) => {
      const record = row.records.find(
        (entry: { studentId: unknown }) => shortId(entry.studentId) === actorId,
      );
      if (!record) return null;
      const context = row.classId
        ? (classById.get(shortId(row.classId)) ?? "Class")
        : "One-on-one";
      return {
        id: shortId(row._id),
        date: new Date(row.date).toISOString(),
        present: record.present,
        context,
      };
    })
    .filter((row): row is StudentAttendanceRow => Boolean(row));
}

export type StudentGradeRow = {
  id: string;
  title: string;
  courseLabel: string;
  score: number;
  feedback: string;
  gradedAt: string | null;
  submittedAt: string;
};

/** Graded submissions with the assignment title and course label. */
export async function listMyGrades(): Promise<StudentGradeRow[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const submissions = await Submission.find({
    studentId: actorId,
    score: { $ne: null },
  })
    .sort({ gradedAt: -1 })
    .lean();
  if (!submissions.length) return [];

  const assignments = await Assignment.find({
    _id: { $in: submissions.map((item) => shortId(item.assignmentId)) },
  })
    .select("title courseId")
    .lean();
  const assignmentById = new Map(
    assignments.map((item) => [shortId(item._id), item]),
  );

  const courseIds = [
    ...new Set(assignments.map((item) => shortId(item.courseId))),
  ];
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
  const courseById = new Map(courses.map((item) => [shortId(item._id), item]));

  return submissions.map((submission) => {
    const assignment = assignmentById.get(shortId(submission.assignmentId));
    const course = assignment
      ? courseById.get(shortId(assignment.courseId))
      : undefined;
    return {
      id: shortId(submission._id),
      title: assignment?.title ?? "Assignment",
      courseLabel: course
        ? `${boardNames.get(shortId(course.boardId)) ?? "Board"} / ${levelNames.get(shortId(course.levelId)) ?? "Level"} / ${subjectNames.get(shortId(course.subjectId)) ?? "Subject"}`
        : "Course",
      score: submission.score ?? 0,
      feedback: submission.feedback ?? "",
      gradedAt: submission.gradedAt
        ? new Date(submission.gradedAt).toISOString()
        : null,
      submittedAt: new Date(submission.submittedAt).toISOString(),
    };
  });
}

export type StudentBookRow = {
  id: string;
  title: string;
  author: string;
  note: string;
  courseLabel: string;
};

/** Recommended books for the student's active courses. */
export async function listMyBooks(): Promise<StudentBookRow[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const enrollments = await Enrollment.find({
    studentId: actorId,
    state: "active",
  })
    .select("courseId")
    .lean();
  const courseIds = [
    ...new Set(enrollments.map((item) => shortId(item.courseId))),
  ];
  if (!courseIds.length) return [];

  const [books, courses, boards, levels, subjects] = await Promise.all([
    Book.find({ courseIds: { $in: courseIds } })
      .sort({ title: 1 })
      .lean(),
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
  const courseById = new Map(courses.map((item) => [shortId(item._id), item]));

  return books.map((book) => {
    const firstCourse = courseById.get(shortId(book.courseIds?.[0]));
    return {
      id: shortId(book._id),
      title: book.title,
      author: book.author ?? "",
      note: book.note ?? "",
      courseLabel: firstCourse
        ? `${boardNames.get(shortId(firstCourse.boardId)) ?? "Board"} / ${levelNames.get(shortId(firstCourse.levelId)) ?? "Level"} / ${subjectNames.get(shortId(firstCourse.subjectId)) ?? "Subject"}`
        : "Course",
    };
  });
}

export type StudentMaterialRow = {
  id: string;
  title: string;
  type: "notes" | "past_paper" | "worksheet" | "other";
  fileUrl: string;
  courseLabel: string;
  createdAt: string;
};

/** Materials for the student's active courses. */
export async function listMyMaterials(): Promise<StudentMaterialRow[]> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const enrollments = await Enrollment.find({
    studentId: actorId,
    state: "active",
  })
    .select("courseId")
    .lean();
  const courseIds = [
    ...new Set(enrollments.map((item) => shortId(item.courseId))),
  ];
  if (!courseIds.length) return [];

  const [materials, courses, boards, levels, subjects] = await Promise.all([
    Material.find({ courseId: { $in: courseIds } })
      .sort({ createdAt: -1 })
      .lean(),
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
  const courseById = new Map(courses.map((item) => [shortId(item._id), item]));

  return materials.map((material) => {
    const course = courseById.get(shortId(material.courseId));
    return {
      id: shortId(material._id),
      title: material.title,
      type: material.type,
      fileUrl: material.fileUrl,
      courseLabel: course
        ? `${boardNames.get(shortId(course.boardId)) ?? "Board"} / ${levelNames.get(shortId(course.levelId)) ?? "Level"} / ${subjectNames.get(shortId(course.subjectId)) ?? "Subject"}`
        : "Course",
      createdAt: new Date(material.createdAt).toISOString(),
    };
  });
}

export type StudentProfile = {
  id: string;
  name: string;
  email: string;
  boardName: string | null;
  levelName: string | null;
  onboarded: boolean;
  teachers: { name: string; courseLabel: string; className: string | null }[];
  activeCourseCount: number;
};

/** Header data for the student panel: board, level and guardian status. */
export async function getMyProfile(): Promise<StudentProfile> {
  const { actorId } = await requireStudentActor();
  await connectDB();

  const student = await User.findById(actorId)
    .select(
      "name email onboarded student.boardId student.levelId student.guardianIds",
    )
    .populate("student.boardId", "name")
    .populate("student.levelId", "name")
    .lean();

  const courses = await listMyCourses();
  const active = courses.filter((item) => item.state === "active");

  return {
    id: String(student?._id ?? actorId),
    name: student?.name ?? "Student",
    email: student?.email ?? "",
    boardName:
      (student?.student?.boardId as unknown as { name?: string } | null)
        ?.name ?? null,
    levelName:
      (student?.student?.levelId as unknown as { name?: string } | null)
        ?.name ?? null,
    onboarded: Boolean(student?.onboarded),
    teachers: active.map((item) => ({
      name: item.teacherName,
      courseLabel: item.courseLabel,
      className: item.className,
    })),
    activeCourseCount: active.length,
  };
}

/** Used by the dashboard to show the class name of the active enrollment. */
export async function getMyClassSnapshot() {
  const { actorId } = await requireStudentActor();
  await connectDB();
  const enrollment = await Enrollment.findOne({
    studentId: actorId,
    state: "active",
  })
    .populate("classId", "name schedule state")
    .lean();
  if (!enrollment) return null;
  const klass = enrollment.classId as unknown as {
    name?: string;
    schedule?: string;
    state?: string;
  } | null;
  return {
    className: klass?.name ?? null,
    schedule: klass?.schedule ?? null,
    classState: klass?.state ?? null,
    classId: enrollment.classId ? shortId(enrollment.classId) : null,
  };
}
