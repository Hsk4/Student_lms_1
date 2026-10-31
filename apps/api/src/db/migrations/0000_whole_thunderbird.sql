CREATE TYPE "public"."access_request_role" AS ENUM('teacher', 'student', 'parent');--> statement-breakpoint
CREATE TYPE "public"."access_request_state" AS ENUM('open', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."class_state" AS ENUM('current', 'past');--> statement-breakpoint
CREATE TYPE "public"."enrollment_state" AS ENUM('requested', 'active', 'declined', 'cancelled', 'ended');--> statement-breakpoint
CREATE TYPE "public"."invoice_state" AS ENUM('unpaid', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('notes', 'past_paper', 'worksheet', 'other');--> statement-breakpoint
CREATE TYPE "public"."meeting_state" AS ENUM('requested', 'confirmed', 'rescheduled', 'cancelled', 'done');--> statement-breakpoint
CREATE TYPE "public"."parent_invite_state" AS ENUM('sent', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."quiz_source" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."quiz_state" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_assignee" AS ENUM('admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_state" AS ENUM('open', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'teacher', 'student', 'parent');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "access_request_subjects" (
	"access_request_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "access_request_subjects_access_request_id_subject_id_pk" PRIMARY KEY("access_request_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"board_id" uuid,
	"level_id" uuid,
	"note" text,
	"requested_role" "access_request_role",
	"state" "access_request_state" DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_email_lowercase" CHECK ("access_requests"."email" = lower("access_requests"."email"))
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid,
	"enrollment_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_exactly_one_target" CHECK (("assignments"."class_id" IS NULL) <> ("assignments"."enrollment_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"present" boolean NOT NULL,
	CONSTRAINT "attendance_records_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid,
	"enrollment_id" uuid,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_sessions_exactly_one_target" CHECK (("attendance_sessions"."class_id" IS NULL) <> ("attendance_sessions"."enrollment_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_name_unique" UNIQUE("name"),
	CONSTRAINT "boards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "book_courses" (
	"book_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "book_courses_book_id_course_id_pk" PRIMARY KEY("book_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"schedule" text,
	"state" "class_state" DEFAULT 'current' NOT NULL,
	"starts_on" timestamp with time zone,
	"ends_on" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"medium" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_board_level_subject_medium_unique" UNIQUE NULLS NOT DISTINCT("board_id","level_id","subject_id","medium")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"class_id" uuid,
	"state" "enrollment_state" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardianships" (
	"student_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardianships_student_id_parent_id_pk" PRIMARY KEY("student_id","parent_id"),
	CONSTRAINT "guardianships_distinct_parties" CHECK ("guardianships"."student_id" <> "guardianships"."parent_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"state" "invoice_state" DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_amount_non_negative" CHECK ("invoices"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levels_name_unique" UNIQUE("name"),
	CONSTRAINT "levels_order_unique" UNIQUE("order")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "material_type" DEFAULT 'other' NOT NULL,
	"file_url" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"requested_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	"state" "meeting_state" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"parent_name" text NOT NULL,
	"parent_email" text DEFAULT '' NOT NULL,
	"code" text NOT NULL,
	"state" "parent_invite_state" DEFAULT 'sent' NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_invites_code_unique" UNIQUE("code"),
	CONSTRAINT "parent_invites_code_uppercase" CHECK ("parent_invites"."code" = upper("parent_invites"."code")),
	CONSTRAINT "parent_invites_attempts_non_negative" CHECK ("parent_invites"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_by" "quiz_source" DEFAULT 'manual' NOT NULL,
	"state" "quiz_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_subjects" (
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_subjects_student_id_subject_id_pk" PRIMARY KEY("student_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_name_unique" UNIQUE("name"),
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"text" text,
	"file_url" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer,
	"feedback" text,
	"graded_by" uuid,
	"graded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_assignment_student_unique" UNIQUE("assignment_id","student_id"),
	CONSTRAINT "submissions_score_range" CHECK ("submissions"."score" IS NULL OR "submissions"."score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"subject" text NOT NULL,
	"state" "support_ticket_state" DEFAULT 'open' NOT NULL,
	"assigned_to" "support_ticket_assignee" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_courses" (
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_courses_teacher_id_course_id_pk" PRIMARY KEY("teacher_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role",
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"board_id" uuid,
	"level_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "access_request_subjects" ADD CONSTRAINT "access_request_subjects_access_request_id_access_requests_id_fk" FOREIGN KEY ("access_request_id") REFERENCES "public"."access_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_request_subjects" ADD CONSTRAINT "access_request_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_courses" ADD CONSTRAINT "book_courses_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_courses" ADD CONSTRAINT "book_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianships" ADD CONSTRAINT "guardianships_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianships" ADD CONSTRAINT "guardianships_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invites" ADD CONSTRAINT "parent_invites_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invites" ADD CONSTRAINT "parent_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_request_subjects_subject_idx" ON "access_request_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "access_requests_user_idx" ON "access_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "access_requests_state_idx" ON "access_requests" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_one_open_per_user" ON "access_requests" USING btree ("user_id") WHERE "access_requests"."state" = 'open';--> statement-breakpoint
CREATE INDEX "assignments_course_idx" ON "assignments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "assignments_teacher_idx" ON "assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "assignments_class_idx" ON "assignments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "assignments_enrollment_idx" ON "assignments" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "attendance_records_student_idx" ON "attendance_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_class_idx" ON "attendance_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_enrollment_idx" ON "attendance_sessions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_date_idx" ON "attendance_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_at_idx" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "boards_active_idx" ON "boards" USING btree ("active");--> statement-breakpoint
CREATE INDEX "book_courses_course_idx" ON "book_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "classes_teacher_idx" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "classes_course_idx" ON "classes" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "classes_state_idx" ON "classes" USING btree ("state");--> statement-breakpoint
CREATE INDEX "courses_board_idx" ON "courses" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "courses_level_idx" ON "courses" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "courses_subject_idx" ON "courses" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "courses_active_idx" ON "courses" USING btree ("active");--> statement-breakpoint
CREATE INDEX "enrollments_student_state_idx" ON "enrollments" USING btree ("student_id","state");--> statement-breakpoint
CREATE INDEX "enrollments_teacher_state_idx" ON "enrollments" USING btree ("teacher_id","state");--> statement-breakpoint
CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_class_idx" ON "enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "guardianships_parent_idx" ON "guardianships" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "invoices_student_idx" ON "invoices" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "invoices_state_idx" ON "invoices" USING btree ("state");--> statement-breakpoint
CREATE INDEX "levels_active_idx" ON "levels" USING btree ("active");--> statement-breakpoint
CREATE INDEX "materials_course_idx" ON "materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "meetings_parent_idx" ON "meetings" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "meetings_teacher_idx" ON "meetings" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "meetings_student_idx" ON "meetings" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "meetings_state_idx" ON "meetings" USING btree ("state");--> statement-breakpoint
CREATE INDEX "parent_invites_student_idx" ON "parent_invites" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "parent_invites_state_idx" ON "parent_invites" USING btree ("state");--> statement-breakpoint
CREATE INDEX "parent_invites_expires_idx" ON "parent_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "parent_invites_parent_email_idx" ON "parent_invites" USING btree ("parent_email","state");--> statement-breakpoint
CREATE INDEX "quizzes_course_idx" ON "quizzes" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "quizzes_student_idx" ON "quizzes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "quizzes_state_idx" ON "quizzes" USING btree ("state");--> statement-breakpoint
CREATE INDEX "student_subjects_subject_idx" ON "student_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "subjects_active_idx" ON "subjects" USING btree ("active");--> statement-breakpoint
CREATE INDEX "submissions_student_idx" ON "submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "support_tickets_created_by_idx" ON "support_tickets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "support_tickets_state_idx" ON "support_tickets" USING btree ("state");--> statement-breakpoint
CREATE INDEX "teacher_courses_course_idx" ON "teacher_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");