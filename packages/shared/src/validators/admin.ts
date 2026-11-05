import { z } from "zod";
import { emailSchema, nameSchema, recordIdSchema } from "./common";

/** /request form. Board, level and subjects are optional so a fresh install works before the catalog exists. */
export const accessRequestSchema = z.object({
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
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || undefined),
  /** Advisory only; the admin still picks the role they approve. */
  requestedRole: z.enum(["teacher", "student", "parent"]).optional(),
});

export type AccessRequestInput = z.input<typeof accessRequestSchema>;

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
