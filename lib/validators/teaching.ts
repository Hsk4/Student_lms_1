import { z } from "zod";
import { objectIdSchema } from "./common";

export const enrollmentRequestSchema = z.object({
  teacherId: objectIdSchema,
  courseId: objectIdSchema,
});

export const enrollmentDecisionSchema = z.object({
  enrollmentId: objectIdSchema,
  decision: z.enum(["accept", "decline"]),
  classId: objectIdSchema.optional(),
});

export const classSchema = z.object({
  courseId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  schedule: z.string().trim().max(200).optional(),
  startsOn: z.string().trim().optional(),
  endsOn: z.string().trim().optional(),
});
