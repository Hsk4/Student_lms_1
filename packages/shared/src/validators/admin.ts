import { z } from "zod";
import { emailSchema, nameSchema, recordIdSchema } from "./common";
import {
  parentApplicationSchema,
  teacherApplicationSchema,
  type ParentApplication,
  type TeacherApplication,
} from "../access-request";

/*
 * /request form.
 *
 * The role decides which application is required, so the schema is a
 * discriminated union: a teacher request is rejected unless the teacher half is
 * complete, a parent request unless the parent half is. `requestedRole` itself
 * is only the applicant's intent — the admin still chooses the role they
 * approve (see `requestDecisionSchema`).
 */
const phoneSchema = z
  .string()
  .trim()
  .max(32, "Keep the phone number under 32 characters")
  .optional()
  .transform((v) => v || undefined);

/*
 * Each structured member checks its own role first. Without that, a teacher
 * body submitted as "parent" would report a dozen missing parent fields
 * instead of the one thing that was actually wrong.
 */
/**
 * A schema for the role field whose *output* type is the exact role.
 *
 * Typed through `z.ZodType` on purpose: a bare `z.literal(role)` leaves its
 * output type widened to `string`, which would stop the API from telling the
 * teacher and parent bodies apart after parsing.
 */
function roleOf<T extends "teacher" | "parent">(role: T): z.ZodType<T> {
  return z
    .string({ error: "Choose a role: teacher or parent" })
    .superRefine((value, ctx) => {
      if (value !== role) {
        ctx.addIssue({
          code: "custom",
          input: value,
          message: "Choose a role: teacher or parent",
        });
      }
    })
    .transform((value) => value as T);
}

/*
 * The parsed shapes are stated by hand (`z.ZodType<…>`): the schemas transform
 * and default their inputs, and the API needs the *output* types to tell the
 * teacher and parent halves apart.
 */
export const teacherRequestBodySchema = z.object({
  requestedRole: roleOf("teacher"),
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  application: teacherApplicationSchema,
}) satisfies z.ZodType<{
  requestedRole: "teacher";
  name: string;
  email: string;
  phone?: string;
  application: TeacherApplication;
}>;

export const parentRequestBodySchema = z.object({
  requestedRole: roleOf("parent"),
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  application: parentApplicationSchema,
}) satisfies z.ZodType<{
  requestedRole: "parent";
  name: string;
  email: string;
  phone?: string;
  application: ParentApplication;
}>;

export const accessRequestSchema = z.union([
  teacherRequestBodySchema,
  parentRequestBodySchema,
  /*
   * Legacy shape, kept so older clients (and the parent sign-up page's
   * one-click request) keep working. It carries no `application` and stores a
   * free-text note.
   */
  z.object({
    /*
     * Legacy bodies may NOT state teacher or parent: those two roles demand the
     * structured application, and letting them through here would let an
     * incomplete application be stored as a note. The same message on all three
     * members is what keeps an unknown role from reporting anything but the
     * role.
     */
    requestedRole: z
      .enum(["student"], {
        error: "Choose a role: teacher or parent",
      })
      .optional(),
    name: nameSchema,
      email: emailSchema,
      boardId: recordIdSchema
        .optional()
        .or(z.literal(""))
        .transform((v) => v || undefined),
      levelId: recordIdSchema
        .optional()
        .or(z.literal(""))
        .transform((v) => v || undefined),
      subjectIds: z
        .union([z.array(recordIdSchema), recordIdSchema.transform((v) => [v])])
        .default([]),
      phone: phoneSchema,
      note: z
        .string()
        .trim()
        .max(1000)
        .optional()
        .transform((v) => v || undefined),
    }),
]);

export type AccessRequestInput = z.input<typeof accessRequestSchema>;
/** What `accessRequestSchema.parse` returns. */
export type ParsedAccessRequest = z.infer<typeof accessRequestSchema>;

/** The two structured members, named so the API can switch on them. */
export interface TeacherRequestBody {
  requestedRole: "teacher";
  name: string;
  email: string;
  phone?: string;
  application: TeacherApplication;
}

export interface ParentRequestBody {
  requestedRole: "parent";
  name: string;
  email: string;
  phone?: string;
  application: ParentApplication;
}
/** The legacy form's shape: board/level/subjects plus a free-text note. */
export type LegacyRequestBody = {
  requestedRole?: "teacher" | "student" | "parent";
  name: string;
  email: string;
  phone?: string;
  boardId?: string;
  levelId?: string;
  subjectIds?: string[];
  note?: string;
};

export const assignRoleSchema = z.object({
  userId: recordIdSchema,
  role: z.enum(["admin", "teacher", "student", "parent"]),
});

export const rejectUserSchema = z.object({
  userId: recordIdSchema,
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

export const userActionSchema = z.object({
  userId: recordIdSchema,
});

export const requestDecisionSchema = z.object({
  requestId: recordIdSchema,
  decision: z.enum(["approve", "reject"]),
  role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
  /**
   * Courses to assign when approving a teacher. Optional: an admin may approve
   * first and pick the classes later from the user's page. Ignored for any
   * other role, because only teachers hold course assignments.
   */
  courseIds: z.array(recordIdSchema).max(100).optional(),
  reason: z.string().trim().max(500).optional(),
});
