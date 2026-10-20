import { z } from "zod";
import { emailSchema, nameSchema } from "./common";

export const studentParentSchema = z.object({
  parentName: nameSchema,
  parentEmail: emailSchema,
});

export const acceptInviteSchema = z.object({
  invitationId: z.string().trim().min(1).max(128),
});

export const inviteParamsSchema = z.string().trim().min(1).max(128);
