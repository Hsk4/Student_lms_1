/**
 * Plain-data row types.
 *
 * These are the app's own vocabulary. Nothing here imports Mongoose, Drizzle or
 * any driver. Every data-access function in `lib/queries/`, `lib/guardians.ts`
 * and the guards returns these, and every action consumes these, so swapping the
 * database means changing the mapping at the boundary and nothing else.
 *
 * Rules for the whole file:
 *  - No `Document`, no `_id`, no `lean()`, no `populate()`, no session handles.
 *  - Ids are opaque `string`s. The backend decides what a string contains.
 *  - Dates are `Date`, timestamps are always present and named `createdAt` /
 *    `updatedAt` to match what the UI already reads.
 *  - Optional-in-Mongo means `| null` here unless the field is genuinely
 *    omitted. `undefined` is reserved for "not selected", never "empty".
 *  - Embedded arrays stay arrays *only* when they are read and written whole.
 *    Anything queried or joined inside gets its own row type (see Guardian,
 *    AttendanceRecord, TicketMessage).
 */

export type Id = string;

export type CreatedUpdated = {
  id: Id;
  createdAt: Date;
  updatedAt: Date;
};

/* -------------------------------------------------------------------------
 * Identity
 * ---------------------------------------------------------------------- */

export type UserRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent";

export type UserStatus = "pending" | "active" | "rejected" | "suspended";

/**
 * The student side of a user.
 *
 * Note what is missing: `guardianIds` and `subjectIds`. Both were embedded
 * arrays that are queried and joined, so they are now `Guardian` rows and a
 * `student_subjects` relation. A student row is what you get from the `users`
 * table plus its `boardId` / `levelId` columns — nothing else.
 */
export type StudentProfile = {
  boardId: Id | null;
  levelId: Id | null;
};

export type User = CreatedUpdated & {
  clerkId: string;
  email: string;
  name: string;
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

export type Student = User & {
  student: StudentProfile;
};

/** A teacher row. Their courses are a relation, not a column. */
export type Teacher = User;

/** A parent row. Their children are `Guardian` rows, not a column. */
export type Parent = User;

/**
 * The parent/student link. Replaces both `student.guardianIds` and
 * `parent.childIds`; the two mirrors cannot diverge any more because there is
 * exactly one row per link.
 */
export type Guardian = {
  studentId: Id;
  parentId: Id;
  createdAt: Date;
};

export type AccessRequestState = "open" | "approved" | "rejected";

export type AccessRequest = CreatedUpdated & {
  userId: Id;
  name: string;
  email: string;
  boardId: Id | null;
  levelId: Id | null;
  subjectIds: Id[];
  note: string | null;
  /** Advisory only: an admin still decides. */
  requestedRole: "teacher" | "student" | "parent" | null;
  state: AccessRequestState;
  decidedBy: Id | null;
  decidedAt: Date | null;
  reason: string | null;
};

export type ParentInviteState = "sent" | "accepted" | "expired" | "revoked";

export type ParentInvite = CreatedUpdated & {
  studentId: Id;
  parentName: string;
  parentEmail: string;
  code: string;
  state: ParentInviteState;
  expiresAt: Date | null;
  acceptedBy: Id | null;
  acceptedAt: Date | null;
  attempts: number;
  lastAttemptAt: Date | null;
};

/** Append-only. `before`/`after` are free-form snapshots, so they stay opaque. */
export type AuditLog = {
  id: Id;
  actorId: Id;
  action: string;
  targetType: string;
  targetId: Id | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: Date;
};

/* -------------------------------------------------------------------------
 * Catalog
 * ---------------------------------------------------------------------- */

export type Board = CreatedUpdated & {
  name: string;
  slug: string;
  active: boolean;
};

export type Level = CreatedUpdated & {
  name: string;
  order: number;
  active: boolean;
};

export type Subject = CreatedUpdated & {
  name: string;
  slug: string;
  active: boolean;
};

export type Course = CreatedUpdated & {
  boardId: Id;
  levelId: Id;
  subjectId: Id;
  /** Empty string was "no medium" in Mongo; it is `null` here. */
  medium: string | null;
  active: boolean;
};

export type Book = CreatedUpdated & {
  title: string;
  author: string | null;
  /** `book_courses` relation. */
  courseIds: Id[];
  note: string | null;
};

export type MaterialType = "notes" | "past_paper" | "worksheet" | "other";

export type Material = CreatedUpdated & {
  courseId: Id;
  title: string;
  type: MaterialType;
  fileUrl: string;
  uploadedBy: Id;
};

/* -------------------------------------------------------------------------
 * Teaching
 * ---------------------------------------------------------------------- */

export type EnrollmentState =
  | "requested"
  | "active"
  | "declined"
  | "cancelled"
  | "ended";

export type Enrollment = CreatedUpdated & {
  studentId: Id;
  teacherId: Id;
  courseId: Id;
  classId: Id | null;
  state: EnrollmentState;
  requestedAt: Date;
  decidedAt: Date | null;
  endReason: string | null;
};

export type ClassState = "current" | "past";

export type ClassRow = CreatedUpdated & {
  teacherId: Id;
  courseId: Id;
  name: string;
  schedule: string | null;
  state: ClassState;
  startsOn: Date | null;
  endsOn: Date | null;
};

/**
 * Exactly one of `classId` / `enrollmentId` is set. The old Mongoose
 * `pre("validate")` hook became a CHECK constraint, so this is a fact the type
 * can express and the database enforces.
 */
export type AttendanceTarget =
  | { classId: Id; enrollmentId: null }
  | { classId: null; enrollmentId: Id };

export type AttendanceRecord = {
  attendanceId: Id;
  studentId: Id;
  present: boolean;
};

export type Attendance = CreatedUpdated &
  AttendanceTarget & {
    date: Date;
    /** `attendance_records` rows. Not embedded any more. */
    records: AttendanceRecord[];
  };

/** Same one-of rule as attendance. */
export type AssignmentTarget =
  | { classId: Id; enrollmentId: null }
  | { classId: null; enrollmentId: Id };

export type Assignment = CreatedUpdated &
  AssignmentTarget & {
    courseId: Id;
    teacherId: Id;
    title: string;
    description: string | null;
    dueAt: Date | null;
  };

export type Submission = CreatedUpdated & {
  assignmentId: Id;
  studentId: Id;
  text: string | null;
  fileUrl: string | null;
  submittedAt: Date;
  /** 0–100, or null when ungraded. */
  score: number | null;
  feedback: string | null;
  gradedBy: Id | null;
  gradedAt: Date | null;
};

/* -------------------------------------------------------------------------
 * Billing, meetings, support
 * ---------------------------------------------------------------------- */

export type InvoiceState = "unpaid" | "paid" | "void";

export type Invoice = CreatedUpdated & {
  studentId: Id;
  period: string;
  amount: number;
  dueDate: Date;
  state: InvoiceState;
  paidAt: Date | null;
  markedBy: Id | null;
};

export type MeetingState =
  | "requested"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "done";

/**
 * `requestedSlots` stays a `string[]` because it is proposed wholesale by the
 * parent and read whole by the teacher — nobody queries inside it. If that
 * changes, it becomes a `meeting_slots` table and only this type moves.
 */
export type Meeting = CreatedUpdated & {
  parentId: Id;
  teacherId: Id;
  studentId: Id;
  requestedSlots: string[];
  confirmedAt: Date | null;
  state: MeetingState;
};

export type SupportTicketState = "open" | "escalated" | "resolved";

export type TicketMessage = {
  id: Id;
  ticketId: Id;
  authorId: Id;
  text: string;
  createdAt: Date;
};

export type SupportTicket = CreatedUpdated & {
  createdBy: Id;
  subject: string;
  /** `ticket_messages` rows. Not embedded any more. */
  messages: TicketMessage[];
  state: SupportTicketState;
  assignedTo: "admin" | "super_admin" | null;
};

/* -------------------------------------------------------------------------
 * Assessment
 * ---------------------------------------------------------------------- */

export type QuestionType = "multiple_choice" | "short_answer" | "essay";

/**
 * Questions stay structured data: they are authored, stored and rendered as a
 * unit, and grading reads the whole set. `jsonb` in Postgres, one type here.
 */
export type Question = {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string | null;
  points: number;
};

export type QuizState = "draft" | "published" | "archived";

export type Quiz = CreatedUpdated & {
  courseId: Id;
  studentId: Id;
  title: string;
  description: string | null;
  questions: Question[];
  generatedBy: "ai" | "manual" | null;
  state: QuizState;
};
