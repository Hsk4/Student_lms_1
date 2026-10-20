import { z } from "zod";
import { emailSchema, nameSchema, objectIdSchema } from "./common";

/** /request form. Board, level and subjects are optional so a fresh install works before the catalog exists. */
export const accessRequestSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  boardId: objectIdSchema
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  levelId: objectIdSchema
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  subjectIds: z
    .union([z.array(objectIdSchema), objectIdSchema.transform((v) => [v])])
    .default([]),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || undefined),
});

export type AccessRequestInput = z.input<typeof accessRequestSchema>;

export const assignRoleSchema = z.object({
  userId: objectIdSchema,
  role: z.enum(["admin", "teacher", "student", "parent"]),
});

export const rejectUserSchema = z.object({
  userId: objectIdSchema,
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

export const userActionSchema = z.object({
  userId: objectIdSchema,
});

export const requestDecisionSchema = z.object({
  requestId: objectIdSchema,
  decision: z.enum(["approve", "reject"]),
  role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
  reason: z.string().trim().max(500).optional(),
});
