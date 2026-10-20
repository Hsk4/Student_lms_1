import { z } from "zod";
import { objectIdSchema } from "./common";

export const assignmentSchema = z
  .object({
    courseId: objectIdSchema,
    classId: objectIdSchema.optional(),
    enrollmentId: objectIdSchema.optional(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(4000).optional(),
    dueAt: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.classId) !== Boolean(value.enrollmentId), {
    message: "Choose exactly one target: a class or one student",
  });

export const submissionSchema = z.object({
  assignmentId: objectIdSchema,
  text: z.string().trim().max(10000).optional(),
  fileUrl: z.string().trim().url().optional(),
});

export const gradeSchema = z.object({
  submissionId: objectIdSchema,
  score: z.coerce.number().min(0).max(100),
  feedback: z.string().trim().max(2000).optional(),
});

export const attendanceSchema = z.object({
  classId: objectIdSchema.optional(),
  enrollmentId: objectIdSchema.optional(),
  date: z.string().trim().min(1),
  presentStudentIds: z.array(objectIdSchema).default([]),
  studentIds: z.array(objectIdSchema).default([]),
});
