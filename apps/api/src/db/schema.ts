/**
 * Postgres schema. This is the only file that knows about tables.
 *
 * Conventions, applied everywhere:
 *  - `uuid` primary keys, `gen_random_uuid()` default (pgcrypto built into PG13+).
 *  - Real foreign keys with an explicit `onDelete` chosen per relation. Nothing
 *    cascades by accident.
 *  - `created_at` / `updated_at` match the old `timestamps: true`. The Mongoose
 *    plugin set both automatically; here `updatedAt` is `$onUpdate`, which
 *    Drizzle fills on every `update()` through it.
 *  - Mongo embedded arrays that are queried or joined became child tables. The
 *    two that are read and written whole (`meetings.requested_slots`,
 *    `quizzes.questions`) stay `jsonb`, typed via `$type<...>()`.
 *  - `jsonb` array defaults are written as `sql`'[]'::jsonb`` on purpose:
 *    drizzle-kit renders a nested array argument to `.default()` as
 *    `'{}'::jsonb` (that is the *object* syntax). The explicit cast is the
 *    same SQL, spelled so a future regeneration cannot change its type.
 *  - Enums are real Postgres enums so bad values cannot be inserted.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Question } from "@/db/types";

/* -------------------------------------------------------------------------
 * Reusable column builders
 * ---------------------------------------------------------------------- */

const id = () =>
  uuid("id").primaryKey().default(sql`gen_random_uuid()`);

/** Filled by the database itself, never by callers. */
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Recomputed on every UPDATE issued through Drizzle. */
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------
 * Enums
 * ---------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", [
  "super_admin",
  "admin",
  "teacher",
  "student",
  "parent",
]);

export const userStatus = pgEnum("user_status", [
  "pending",
  "active",
  "rejected",
  "suspended",
]);

export const accessRequestState = pgEnum("access_request_state", [
  "open",
  "approved",
  "rejected",
]);

export const accessRequestRole = pgEnum("access_request_role", [
  "teacher",
  "student",
  "parent",
]);

export const parentInviteState = pgEnum("parent_invite_state", [
  "sent",
  "accepted",
  "expired",
  "revoked",
]);

export const materialType = pgEnum("material_type", [
  "notes",
  "past_paper",
  "worksheet",
  "other",
]);

export const enrollmentState = pgEnum("enrollment_state", [
  "requested",
  "active",
  "declined",
  "cancelled",
  "ended",
]);

export const classState = pgEnum("class_state", ["current", "past"]);

export const invoiceState = pgEnum("invoice_state", ["unpaid", "paid", "void"]);

export const meetingState = pgEnum("meeting_state", [
  "requested",
  "confirmed",
  "rescheduled",
  "cancelled",
  "done",
]);

export const supportTicketState = pgEnum("support_ticket_state", [
  "open",
  "escalated",
  "resolved",
]);

export const supportTicketAssignee = pgEnum("support_ticket_assignee", [
  "admin",
  "super_admin",
]);

export const quizState = pgEnum("quiz_state", [
  "draft",
  "published",
  "archived",
]);

export const quizSource = pgEnum("quiz_source", ["ai", "manual"]);

// Questions live in `quizzes.questions` (jsonb), so `Question.type` is validated
// by the `Question` type and the Zod schema, not by a Postgres enum.

/* -------------------------------------------------------------------------
 * Identity
 * ---------------------------------------------------------------------- */

/**
 * Catalog tables are declared before `users` because the student profile points
 * at them, and Postgres needs the target table to exist.
 */

export const boards = pgTable("boards", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  unique("boards_name_unique").on(table.name),
  unique("boards_slug_unique").on(table.slug),
  index("boards_active_idx").on(table.active),
]);

export const levels = pgTable("levels", {
  id: id(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  unique("levels_name_unique").on(table.name),
  unique("levels_order_unique").on(table.order),
  index("levels_active_idx").on(table.active),
]);

export const subjects = pgTable("subjects", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  unique("subjects_name_unique").on(table.name),
  unique("subjects_slug_unique").on(table.slug),
  index("subjects_active_idx").on(table.active),
]);

export const users = pgTable("users", {
  id: id(),
  clerkId: text("clerk_id").notNull(),
  /** Nullable only for accounts created before local password authentication. */
  passwordHash: text("password_hash"),
  /** Stored lowercase; enforce it with the CHECK below rather than in app code. */
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: userRole("role"),
  status: userStatus("status").notNull().default("pending"),
  onboarded: boolean("onboarded").notNull().default(false),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  /** Was `student.boardId`. Null for non-students. */
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "restrict" }),
  /** Was `student.levelId`. */
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  unique("users_clerk_id_unique").on(table.clerkId),
  index("users_role_idx").on(table.role),
  index("users_status_idx").on(table.status),
  index("users_email_idx").on(table.email),
  // Keep the old lowercase rule from Mongoose (`lowercase: true`).
  check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
]);

/**
 * Replaces **both** `student.guardianIds` and `parent.childIds`.
 *
 * The composite primary key makes the same link impossible to store twice, so
 * `$addToSet` semantics come for free. The reverse index answers "children of a
 * parent" without the scan the old mirror array existed to avoid.
 */
export const guardianships = pgTable("guardianships", {
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.studentId, table.parentId] }),
  index("guardianships_parent_idx").on(table.parentId),
  // A user cannot be their own guardian.
  check("guardianships_distinct_parties", sql`${table.studentId} <> ${table.parentId}`),
]);

/** Was `student.subjectIds[]`. */
export const studentSubjects = pgTable("student_subjects", {
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.studentId, table.subjectId] }),
  index("student_subjects_subject_idx").on(table.subjectId),
]);

export const accessRequests = pgTable("access_requests", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "set null" }),
  note: text("note"),
  requestedRole: accessRequestRole("requested_role"),
  state: accessRequestState("state").notNull().default("open"),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  reason: text("reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("access_requests_user_idx").on(table.userId),
  index("access_requests_state_idx").on(table.state),
  check("access_requests_email_lowercase", sql`${table.email} = lower(${table.email})`),
  // Was a partial unique index: one OPEN request per user. A partial unique
  // index is still the right tool in Postgres.
  uniqueIndex("access_requests_one_open_per_user")
    .on(table.userId)
    .where(sql`${table.state} = 'open'`),
]);

/** Was `AccessRequest.subjectIds[]`. */
export const accessRequestSubjects = pgTable("access_request_subjects", {
  accessRequestId: uuid("access_request_id")
    .notNull()
    .references(() => accessRequests.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.accessRequestId, table.subjectId] }),
  index("access_request_subjects_subject_idx").on(table.subjectId),
]);

export const parentInvites = pgTable("parent_invites", {
  id: id(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentName: text("parent_name").notNull(),
  parentEmail: text("parent_email").notNull().default(""),
  /** Short human code: uppercase, no lookalike characters. */
  code: text("code").notNull(),
  state: parentInviteState("state").notNull().default("sent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  /** Failed redemptions. Incremented atomically in SQL, never read-then-write. */
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  unique("parent_invites_code_unique").on(table.code),
  index("parent_invites_student_idx").on(table.studentId),
  index("parent_invites_state_idx").on(table.state),
  index("parent_invites_expires_idx").on(table.expiresAt),
  index("parent_invites_parent_email_idx").on(table.parentEmail, table.state),
  check("parent_invites_code_uppercase", sql`${table.code} = upper(${table.code})`),
  check("parent_invites_attempts_non_negative", sql`${table.attempts} >= 0`),
]);

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  // No cascade: an audit trail must not vanish with the actor it records.
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  // Deliberately NOT a foreign key: the target may be any table, and may be
  // deleted while its history stays relevant.
  targetId: uuid("target_id"),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_actor_idx").on(table.actorId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_target_idx").on(table.targetType, table.targetId),
  index("audit_logs_at_idx").on(table.at),
]);

/* -------------------------------------------------------------------------
 * Catalog (courses depend on the three above, so it lives here)
 * ---------------------------------------------------------------------- */

export const courses = pgTable("courses", {
  id: id(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "restrict" }),
  levelId: uuid("level_id")
    .notNull()
    .references(() => levels.id, { onDelete: "restrict" }),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),
  /** Was `medium` defaulting to "". Empty means no medium, so it is NULL here. */
  medium: text("medium"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  // The old MongoDB unique index counted the empty string as a value. With a
  // nullable column, NULL is normally "distinct", which would allow duplicates.
  // NULLS NOT DISTINCT restores the original rule (Postgres 15+).
  unique("courses_board_level_subject_medium_unique")
    .on(table.boardId, table.levelId, table.subjectId, table.medium)
    .nullsNotDistinct(),
  index("courses_board_idx").on(table.boardId),
  index("courses_level_idx").on(table.levelId),
  index("courses_subject_idx").on(table.subjectId),
  index("courses_active_idx").on(table.active),
]);

/** Was `teacher.courseIds[]`. */
export const teacherCourses = pgTable("teacher_courses", {
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.teacherId, table.courseId] }),
  index("teacher_courses_course_idx").on(table.courseId),
]);

export const books = pgTable("books", {
  id: id(),
  title: text("title").notNull(),
  author: text("author"),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Was `Book.courseIds[]`. */
export const bookCourses = pgTable("book_courses", {
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.bookId, table.courseId] }),
  index("book_courses_course_idx").on(table.courseId),
]);

export const materials = pgTable("materials", {
  id: id(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: materialType("type").notNull().default("other"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("materials_course_idx").on(table.courseId),
]);

/* -------------------------------------------------------------------------
 * Teaching
 * ---------------------------------------------------------------------- */

export const classes = pgTable("classes", {
  id: id(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  schedule: text("schedule"),
  state: classState("state").notNull().default("current"),
  startsOn: timestamp("starts_on", { withTimezone: true }),
  endsOn: timestamp("ends_on", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("classes_teacher_idx").on(table.teacherId),
  index("classes_course_idx").on(table.courseId),
  index("classes_state_idx").on(table.state),
]);

export const enrollments = pgTable("enrollments", {
  id: id(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  state: enrollmentState("state").notNull().default("requested"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  endReason: text("end_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("enrollments_student_state_idx").on(table.studentId, table.state),
  index("enrollments_teacher_state_idx").on(table.teacherId, table.state),
  index("enrollments_course_idx").on(table.courseId),
  index("enrollments_class_idx").on(table.classId),
]);

/**
 * Was `Attendance.records[]` plus a `pre("validate")` hook.
 *
 * The hook is now a CHECK on the parent row. `date` is a real `date`, not a
 * timestamp: the old field held a moment but was only ever used for the day.
 */
export const attendanceSessions = pgTable("attendance_sessions", {
  id: id(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  // Exactly one of the two targets, enforced by the database.
  check(
    "attendance_sessions_exactly_one_target",
    sql`(${table.classId} IS NULL) <> (${table.enrollmentId} IS NULL)`,
  ),
  index("attendance_sessions_class_idx").on(table.classId),
  index("attendance_sessions_enrollment_idx").on(table.enrollmentId),
  index("attendance_sessions_date_idx").on(table.date),
]);

export const attendanceRecords = pgTable("attendance_records", {
  sessionId: uuid("session_id")
    .notNull()
    .references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  present: boolean("present").notNull(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.studentId] }),
  index("attendance_records_student_idx").on(table.studentId),
]);

export const assignments = pgTable("assignments", {
  id: id(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "restrict" }),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  // Same one-of rule as attendance.
  check(
    "assignments_exactly_one_target",
    sql`(${table.classId} IS NULL) <> (${table.enrollmentId} IS NULL)`,
  ),
  index("assignments_course_idx").on(table.courseId),
  index("assignments_teacher_idx").on(table.teacherId),
  index("assignments_class_idx").on(table.classId),
  index("assignments_enrollment_idx").on(table.enrollmentId),
]);

export const submissions = pgTable("submissions", {
  id: id(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  text: text("text"),
  fileUrl: text("file_url"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  score: integer("score"),
  feedback: text("feedback"),
  gradedBy: uuid("graded_by").references(() => users.id, { onDelete: "set null" }),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  // One submission per student per assignment (was a unique compound index).
  unique("submissions_assignment_student_unique").on(table.assignmentId, table.studentId),
  index("submissions_student_idx").on(table.studentId),
  check("submissions_score_range", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 100`),
]);

/* -------------------------------------------------------------------------
 * Billing, meetings, support
 * ---------------------------------------------------------------------- */

export const invoices = pgTable("invoices", {
  id: id(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  period: text("period").notNull(),
  /** `numeric` not `float`: money must not round like a double. */
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  state: invoiceState("state").notNull().default("unpaid"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  markedBy: uuid("marked_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("invoices_student_idx").on(table.studentId),
  index("invoices_state_idx").on(table.state),
  check("invoices_amount_non_negative", sql`${table.amount} >= 0`),
]);

export const meetings = pgTable("meetings", {
  id: id(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  /**
   * Proposed slots, read and written whole: jsonb is the right shape. Defaulted
   * in SQL rather than through Drizzle's `default([])`, which would JSON-encode
   * the argument and store the *string* `'[]'` instead of an array.
   */
  requestedSlots: jsonb("requested_slots")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  state: meetingState("state").notNull().default("requested"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("meetings_parent_idx").on(table.parentId),
  index("meetings_teacher_idx").on(table.teacherId),
  index("meetings_student_idx").on(table.studentId),
  index("meetings_state_idx").on(table.state),
]);

export const supportTickets = pgTable("support_tickets", {
  id: id(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  state: supportTicketState("state").notNull().default("open"),
  assignedTo: supportTicketAssignee("assigned_to").notNull().default("admin"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("support_tickets_created_by_idx").on(table.createdBy),
  index("support_tickets_state_idx").on(table.state),
]);

/** Was `SupportTicket.messages[]` (an embedded array with `_id: false`). */
export const ticketMessages = pgTable("ticket_messages", {
  id: id(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  text: text("text").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("ticket_messages_ticket_idx").on(table.ticketId, table.createdAt),
]);

/* -------------------------------------------------------------------------
 * Assessment
 * ---------------------------------------------------------------------- */

export const quizzes = pgTable("quizzes", {
  id: id(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  /** Authored and rendered as a whole, never queried inside: jsonb. */
  questions: jsonb("questions")
    .$type<Question[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  generatedBy: quizSource("generated_by").notNull().default("manual"),
  state: quizState("state").notNull().default("draft"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("quizzes_course_idx").on(table.courseId),
  index("quizzes_student_idx").on(table.studentId),
  index("quizzes_state_idx").on(table.state),
]);
