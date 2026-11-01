import { z } from "zod";
import { recordIdSchema } from "./common";

export const enrollmentRequestSchema = z.object({
  teacherId: recordIdSchema,
  courseId: recordIdSchema,
});

export const enrollmentDecisionSchema = z.object({
  enrollmentId: recordIdSchema,
  decision: z.enum(["accept", "decline"]),
  classId: recordIdSchema.optional(),
});

export const classSchema = z.object({
  courseId: recordIdSchema,
  name: z.string().trim().min(2).max(120),
  schedule: z.string().trim().max(200).optional(),
  startsOn: z.string().trim().optional(),
  endsOn: z.string().trim().optional(),
});
