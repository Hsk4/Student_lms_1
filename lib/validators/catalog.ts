import { z } from "zod";
import {
  nameSchema,
  objectIdSchema,
  optionalTextSchema,
  slugSchema,
} from "./common";
export const boardSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  active: z.boolean().default(true),
});

export const levelSchema = z.object({
  name: nameSchema,
  order: z.coerce.number().int().min(0).max(999),
  active: z.boolean().default(true),
});

export const subjectSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  active: z.boolean().default(true),
});

/** Medium is optional free text; it is stored as '' so the unique index covers it. */
export const courseSchema = z.object({
  boardId: objectIdSchema,
  levelId: objectIdSchema,
  subjectId: objectIdSchema,
  medium: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || ""),
  active: z.boolean().default(true),
});

export const bookSchema = z.object({
  title: nameSchema,
  author: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  courseIds: z.array(objectIdSchema).default([]),
  note: optionalTextSchema,
});

export const materialSchema = z.object({
  courseId: objectIdSchema,
  title: nameSchema,
  type: z.enum(["notes", "past_paper", "worksheet", "other"]),
  fileUrl: z.string().trim().pipe(z.url("Enter a URL")),
});

export const toggleSchema = z.object({
  id: objectIdSchema,
  active: z.boolean(),
});

export const idSchema = z.object({ id: objectIdSchema });
