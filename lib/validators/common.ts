import { z } from "zod";

/**
 * The single definition of "a row id" for input validation.
 *
 * Ids are Postgres `uuid` primary keys, so this is a UUID regex. This is the
 * one place in the app that knows what an id looks like. Do not redeclare this
 * pattern anywhere else — import it.
 */
export const recordIdSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid id",
  );



/** Optional form input that must be a valid id when present. */
export const optionalRecordIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(recordIdSchema.optional());

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
