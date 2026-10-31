import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, requireRole } from "@/middleware/auth";
import { ok } from "@/lib/respond";
import {
  cancelMismatchedEnrollments,
  createClass,
  decideEnrollment,
  getEnrollment,
  listEnrollmentsAdmin,
  markClassPast,
  matchingTeachers,
  myChildren,
  reassignStudent,
  requestEnrollment,
  teacherStudent,
} from "@/controllers/teaching";
import {
  classDetail,
  courseChoices,
  studentDetail,
  dashboard,
  listClasses,
  myAssignments as teacherAssignments,
  myAttendance as teacherAttendance,
  myMeetings as teacherMeetings,
  requests as teacherRequests,
  students as teacherStudents,
  unassignedCount,
  ungradedCount,
} from "@/controllers/teacher";
import {
  listMyAssignments,
  listMyAttendance,
  listMyBooks,
  listMyCourses,
  listMyGrades,
  listMyMaterials,
  myBookOptions,
  myCourseOptions,
  mySubmission,
  profile,
} from "@/controllers/student";
import {
  getChildOverview,
  listChildOverviews,
  requestMeeting,
  rescheduleMeeting,
} from "@/controllers/parent-panel";
import {
  confirmMeeting,
  parentMeetings,
  requestNewSlot,
} from "@/controllers/meetings";
import {
  allInvoices,
  createInvoiceRow,
  markInvoicePaid,
  studentInvoices,
} from "@/controllers/invoices";
import {
  addTicketMessage,
  createSupportTicket,
  escalateTicket,
  myTickets,
} from "@/controllers/support";
import {
  createAssignment,
  gradeSubmission,
  saveAttendance,
  submitAssignment,
} from "@/controllers/assessment";

const teacher = [auth(), requireRole("teacher")];
const student = [auth(), requireRole("student")];
const parent = [auth(), requireRole("parent")];
const admin = [auth(), requireRole("admin", "super_admin")];
const active = [auth()];

export const panelRoutes = Router();

/* Enrollments */
panelRoutes.post(
  "/student/enrollments",
  ...student,
  asyncHandler(async (req, res) => {
    await requestEnrollment(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/enrollments/:id/decision",
  ...teacher,
  asyncHandler(async (req, res) => {
    await decideEnrollment(req);
    ok(res, null);
  }),
);
panelRoutes.get(
  "/enrollments/:id",
  ...active,
  asyncHandler(async (req, res) => ok(res, await getEnrollment(req))),
);
panelRoutes.post(
  "/teacher/classes",
  ...teacher,
  asyncHandler(async (req, res) => {
    await createClass(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/classes/:id/past",
  ...teacher,
  asyncHandler(async (req, res) => {
    await markClassPast(req);
    ok(res, null);
  }),
);
panelRoutes.get(
  "/student/teachers",
  ...student,
  asyncHandler(async (req, res) => ok(res, await matchingTeachers(req))),
);
panelRoutes.get(
  "/teacher/students/:id",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherStudent(req))),
);
panelRoutes.get(
  "/teacher/students/:id/detail",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await studentDetail(req))),
);
panelRoutes.get(
  "/parent/children",
  ...parent,
  asyncHandler(async (req, res) => ok(res, await myChildren(req))),
);

/* Admin enrollment tools */
panelRoutes.get(
  "/admin/enrollments",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await listEnrollmentsAdmin(req))),
);
panelRoutes.post(
  "/admin/enrollments/:id/reassign",
  ...admin,
  asyncHandler(async (req, res) => {
    await reassignStudent(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/admin/enrollments/cancel-mismatched",
  ...admin,
  asyncHandler(async (req, res) =>
    ok(res, await cancelMismatchedEnrollments(req)),
  ),
);

/* Teacher panel */
panelRoutes.get(
  "/teacher/dashboard",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await dashboard(req))),
);
panelRoutes.get(
  "/teacher/students",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherStudents(req))),
);
panelRoutes.get(
  "/teacher/requests",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherRequests(req))),
);
panelRoutes.get(
  "/teacher/classes",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await listClasses(req))),
);
panelRoutes.get(
  "/teacher/classes/:id",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await classDetail(req))),
);
panelRoutes.get(
  "/teacher/assignments",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherAssignments(req))),
);
panelRoutes.get(
  "/teacher/attendance",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherAttendance(req))),
);
panelRoutes.get(
  "/teacher/meetings",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await teacherMeetings(req))),
);
panelRoutes.get(
  "/teacher/courses",
  ...teacher,
  asyncHandler(async (req, res) => ok(res, await courseChoices(req))),
);
panelRoutes.get(
  "/teacher/counts",
  ...teacher,
  asyncHandler(async (req, res) =>
    ok(res, {
      unassigned: (await unassignedCount(req)).count,
      ungraded: (await ungradedCount(req)).count,
    }),
  ),
);
panelRoutes.post(
  "/teacher/assignments",
  ...teacher,
  asyncHandler(async (req, res) => {
    await createAssignment(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/submissions/:id/grade",
  ...teacher,
  asyncHandler(async (req, res) => {
    await gradeSubmission(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/attendance",
  ...teacher,
  asyncHandler(async (req, res) => {
    await saveAttendance(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/meetings/:id/confirm",
  ...teacher,
  asyncHandler(async (req, res) => {
    await confirmMeeting(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/teacher/meetings/:id/request-slot",
  ...teacher,
  asyncHandler(async (req, res) => {
    await requestNewSlot(req);
    ok(res, null);
  }),
);

/* Student panel */
panelRoutes.get(
  "/student/courses",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyCourses(req))),
);
panelRoutes.get(
  "/student/assignments",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyAssignments(req))),
);
panelRoutes.get(
  "/student/attendance",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyAttendance(req))),
);
panelRoutes.get(
  "/student/grades",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyGrades(req))),
);
panelRoutes.get(
  "/student/books",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyBooks(req))),
);
panelRoutes.get(
  "/student/materials",
  ...student,
  asyncHandler(async (req, res) => ok(res, await listMyMaterials(req))),
);
panelRoutes.get(
  "/student/profile",
  ...student,
  asyncHandler(async (req, res) => ok(res, await profile(req))),
);
panelRoutes.get(
  "/student/submissions",
  ...student,
  asyncHandler(async (req, res) => ok(res, await mySubmission(req))),
);
panelRoutes.get(
  "/student/course-options",
  ...student,
  asyncHandler(async (req, res) => ok(res, await myCourseOptions(req))),
);
panelRoutes.get(
  "/student/book-options",
  ...student,
  asyncHandler(async (req, res) => ok(res, await myBookOptions(req))),
);
panelRoutes.get(
  "/student/quizzes",
  ...student,
  asyncHandler(async (_req, res) => ok(res, [])),
);
panelRoutes.post(
  "/student/submissions",
  ...student,
  asyncHandler(async (req, res) => {
    await submitAssignment(req);
    ok(res, null);
  }),
);

/* Parent panel */
panelRoutes.get(
  "/parent/overview",
  ...parent,
  asyncHandler(async (req, res) => ok(res, await listChildOverviews(req))),
);
panelRoutes.get(
  "/parent/children/:id",
  ...parent,
  asyncHandler(async (req, res) => ok(res, await getChildOverview(req))),
);
panelRoutes.post(
  "/parent/meetings",
  ...parent,
  asyncHandler(async (req, res) => {
    await requestMeeting(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/parent/meetings/:id/reschedule",
  ...parent,
  asyncHandler(async (req, res) => {
    await rescheduleMeeting(req);
    ok(res, null);
  }),
);
panelRoutes.get(
  "/parent/meetings",
  ...parent,
  asyncHandler(async (req, res) => ok(res, await parentMeetings(req))),
);

/* Invoices */
panelRoutes.get(
  "/invoices",
  ...active,
  asyncHandler(async (req, res) => ok(res, await studentInvoices(req))),
);
panelRoutes.get(
  "/admin/invoices",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await allInvoices())),
);
panelRoutes.post(
  "/admin/invoices",
  ...admin,
  asyncHandler(async (req, res) => {
    await createInvoiceRow(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/admin/invoices/:id/paid",
  ...admin,
  asyncHandler(async (req, res) => {
    await markInvoicePaid(req);
    ok(res, null);
  }),
);

/* Support */
panelRoutes.get(
  "/support/tickets",
  ...active,
  asyncHandler(async (req, res) => ok(res, await myTickets(req))),
);
panelRoutes.post(
  "/support/tickets",
  ...active,
  asyncHandler(async (req, res) => {
    await createSupportTicket(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/support/tickets/:id/messages",
  ...active,
  asyncHandler(async (req, res) => {
    await addTicketMessage(req);
    ok(res, null);
  }),
);
panelRoutes.post(
  "/admin/tickets/:id/escalate",
  ...admin,
  asyncHandler(async (req, res) => {
    await escalateTicket(req);
    ok(res, null);
  }),
);


