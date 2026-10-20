import "server-only";
import { connectDB } from "@/lib/db";
import { Assignment } from "@/models/assignment";
import { Submission } from "@/models/submission";
import { Attendance } from "@/models/attendance";
import { Enrollment } from "@/models/enrollment";
import { Class } from "@/models/class";

const shortId = (reference: unknown) => String(reference);

/** Students can see assignments for a class they are enrolled in, or for their one-on-one enrollment. */
export async function listStudentAssignments(
  studentId: string,
  courseId: string,
) {
  await connectDB();
  const enrollments = await Enrollment.find({
    studentId,
    courseId,
    state: "active",
  }).lean();
  if (!enrollments.length) return [];
  const classIds = enrollments.map((item) => item.classId).filter(Boolean);
  const enrollmentIds = enrollments.map((item) => item._id);
  const assignments = await Assignment.find({
    courseId,
    $or: [
      { classId: { $in: classIds } },
      { enrollmentId: { $in: enrollmentIds } },
    ],
  })
    .sort({ dueAt: 1 })
    .lean();
  const submissions = await Submission.find({
    studentId,
    assignmentId: { $in: assignments.map((item) => item._id) },
  }).lean();
  const byAssignment = new Map(
    submissions.map((item) => [shortId(item.assignmentId), item]),
  );

  return assignments.map((item) => {
    const submission = byAssignment.get(shortId(item._id));
    return {
      id: shortId(item._id),
      title: item.title,
      description: item.description ?? "",
      dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
      submissionId: submission ? shortId(submission._id) : null,
      score: submission?.score ?? null,
      feedback: submission?.feedback ?? "",
    };
  });
}

export async function listTeacherAssignments(teacherId: string) {
  await connectDB();
  const assignments = await Assignment.find({ teacherId })
    .sort({ createdAt: -1 })
    .lean();
  const submissions = await Submission.find({
    assignmentId: { $in: assignments.map((item) => item._id) },
  }).lean();
  const byAssignment = new Map<string, typeof submissions>();
  for (const submission of submissions) {
    const key = shortId(submission.assignmentId);
    byAssignment.set(key, [...(byAssignment.get(key) ?? []), submission]);
  }
  return assignments.map((item) => ({
    id: shortId(item._id),
    title: item.title,
    dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
    classId: item.classId ? shortId(item.classId) : null,
    enrollmentId: item.enrollmentId ? shortId(item.enrollmentId) : null,
    submissions: (byAssignment.get(shortId(item._id)) ?? []).map(
      (submission) => ({
        id: shortId(submission._id),
        studentId: shortId(submission.studentId),
        text: submission.text ?? "",
        score: submission.score ?? null,
        feedback: submission.feedback ?? "",
      }),
    ),
  }));
}

export async function listAttendance(teacherId: string) {
  await connectDB();
  const [classes, enrollments] = await Promise.all([
    Class.find({ teacherId }).select("_id").lean(),
    Enrollment.find({ teacherId }).select("_id").lean(),
  ]);
  const entries = await Attendance.find({
    $or: [
      { classId: { $in: classes.map((row) => row._id) } },
      { enrollmentId: { $in: enrollments.map((row) => row._id) } },
    ],
  })
    .sort({ date: -1 })
    .limit(100)
    .lean();
  return entries.map((entry) => ({
    id: shortId(entry._id),
    date: new Date(entry.date).toISOString(),
    present: entry.records.filter((record: { present: boolean }) => record.present).length,
    total: entry.records.length,
  }));
}
