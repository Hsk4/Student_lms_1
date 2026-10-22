import { z } from "zod";
import { emailSchema, nameSchema } from "./common";

export const studentParentSchema = z.object({
  parentName: nameSchema,
  // Optional: the link code is what identifies the parent, not the address.
  parentEmail: emailSchema.optional(),
});

export const redeemLinkCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "That code is too short")
    .max(24, "That code is too long"),
});
