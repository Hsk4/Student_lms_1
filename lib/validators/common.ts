import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and dashes only",
  );

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Too short")
  .max(120, "Too long");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));

export const optionalTextSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => value || undefined);
