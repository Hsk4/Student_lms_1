import { randomInt } from "node:crypto";
import { connectDB } from "@/lib/db";
import { ParentInvite } from "@/models/parent-invite";

/**
 * Link codes are typed by hand, often read aloud, so the alphabet excludes the
 * characters that get confused: 0/O, 1/I/L, 5/S, 8/B, 2/Z.
 */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const CODE_LENGTH = 8;

export function newLinkCode(): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Accepts "abcd-efgh", " abcd efgh " and lowercase; returns the canonical code. */
export function normalizeLinkCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** How long a code stays valid. */
export const LINK_CODE_TTL_DAYS = 14;

/**
 * Generates a code that no existing invite holds. The unique index is the real
 * guard; this avoids the cheap collision.
 */
export async function uniqueLinkCode(): Promise<string> {
  await connectDB();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newLinkCode();
    const taken = await ParentInvite.exists({ code });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique link code, try again");
}
