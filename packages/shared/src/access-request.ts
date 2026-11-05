import { z } from "zod";
import { emailSchema, nameSchema, recordIdSchema } from "./validators/common";

/**
 * Access requests, shared by the API and the admin panel.
 *
 * A request is a request for (at most) one of two roles: `teacher` or `parent`.
 * The role decides which application was filled in, so each role has its own
 * structured payload instead of one generic "note" field:
 *
 *   requestedRole: "teacher" -> application.teacher
 *   requestedRole: "parent"  -> application.parent
 *
 * The payload is validated by the API and stored as-is; the admin panel renders
 * whichever half is present. Legacy requests (created before this split) have
 * neither half: they carry `requestedRole: "student"` and a free-text note, and
 * both the API and the UI fall back to that.
 */

export const REQUEST_ROLES = ["teacher", "parent"] as const;

export type RequestedRole = (typeof REQUEST_ROLES)[number];

/** Anything an old request might hold, including the retired `student`. */
export type LegacyRequestedRole = RequestedRole | "student";

/* ---------------------------------------------------------------------------
 * Teacher application
 * ------------------------------------------------------------------------- */

const text = (trigger: string, max: number) =>
  z
    .string({ error: trigger })
    .trim()
    .max(max, `Keep this under ${max} characters`);

/** Required free text: a message names the field so the form can show it. */
const requiredText = (message: string, max: number) =>
  text(message, max).min(1, message);

export const teacherApplicationSchema = z.object({
  /** Chosen from the catalog (`form-options.subjects`). */
  subjects: z
    .array(recordIdSchema)
    .min(1, "Pick at least one subject you teach")
    .max(30, "Pick at most 30 subjects")
    .default([]),
  /** Chosen from the catalog (`form-options.levels`). */
  gradeLevels: z
    .array(recordIdSchema)
    .min(1, "Pick at least one grade level")
    .max(30, "Pick at most 30 grade levels")
    .default([]),
  experienceYears: z.coerce
    .number({ error: "Enter the number of years you have taught" })
    .int("Years must be a whole number")
    .min(0, "Years cannot be negative")
    .max(60, "That is too many years of experience"),
  previousInstitution: text("Enter your current or previous institution", 160),
  qualifications: requiredText("Add your highest qualification", 200),
  certifications: text("List your teaching certifications", 300).optional(),
  /** The teaching experience/background description. */
  experience: requiredText(
    "Describe your teaching experience so the office can review it",
    4000,
  ),
  motivation: requiredText("Tell us why you want to teach here", 2000),
  availability: requiredText("Tell us when you are available to teach", 300),
  bio: text("Add a short professional bio", 600).optional(),
  additionalInformation: text("Add any additional information", 2000).optional(),
});

export type TeacherApplication = {
  subjects: string[];
  gradeLevels: string[];
  experienceYears: number;
  previousInstitution: string;
  qualifications: string;
  certifications?: string;
  experience: string;
  motivation: string;
  availability: string;
  bio?: string;
  additionalInformation?: string;
};

/* ---------------------------------------------------------------------------
 * Parent application
 * ------------------------------------------------------------------------- */

export const PARENT_RELATIONSHIPS = [
  "mother",
  "father",
  "guardian",
  "grandparent",
  "sibling",
  "other",
] as const;

export type ParentRelationship = (typeof PARENT_RELATIONSHIPS)[number];

export const PARENT_RELATIONSHIP_LABELS: Record<ParentRelationship, string> = {
  mother: "Mother",
  father: "Father",
  guardian: "Legal guardian",
  grandparent: "Grandparent",
  sibling: "Sibling",
  other: "Other",
};

/** A student account is identified either by email or by its student code. */
const studentKey = text("Add the student's email or student code", 160)
  .min(3, "Add the student's email or student code")
  .max(160);

export const parentApplicationSchema = z.object({
  relationship: z.enum(PARENT_RELATIONSHIPS, {
    error: "Choose your relationship to the student",
  }),
  studentName: nameSchema,
  studentKey,
  studentEmail: z
    .union([emailSchema, z.literal("")])
    .optional()
    .transform((v) => v || undefined),
  motivation: requiredText("Tell us why you need parent access", 2000),
  additionalInformation: text("Add any additional information", 2000).optional(),
});

export type ParentApplication = {
  relationship: ParentRelationship;
  studentName: string;
  studentKey: string;
  studentEmail?: string;
  motivation: string;
  additionalInformation?: string;
};



/* ---------------------------------------------------------------------------
 * The stored request, as the admin panel receives it
 * ------------------------------------------------------------------------- */

/** Nulls in either half mean "legacy request, no structured data". */
export type AccessRequestApplication = {
  teacher: TeacherApplication | null;
  parent: ParentApplication | null;
};

export type AdminRequestView = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  /** Null on legacy requests that never stated a role. */
  requestedRole: LegacyRequestedRole | null;
  state: "open" | "approved" | "rejected";
  createdAt: string;
  board?: string;
  level?: string;
  subjects: string;
  subjectIds: string[];
  /** Stored as ids; resolved to labels by the API for display. */
  subjectLabels: string[];
  levelLabels: string[];
  application: AccessRequestApplication;
  /** Free-text note; the whole application on a legacy request. */
  note?: string;
  /** The applicant's account, as far as the review needs it. */
  userStatus: string;
  userRole: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
};
