import { z } from "zod";
import { emailSchema, nameSchema } from "./common";

/** A student adds a parent by name and email. Email is optional so onboarding can be tested without a provider. */
export const parentInviteSchema = z.object({
  parentName: nameSchema,
  parentEmail: emailSchema.optional().or(z.literal("")),
});
