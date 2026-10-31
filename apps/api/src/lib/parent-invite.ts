/**
 * Parent linking is by short code, not by Clerk invitation: the student issues
 * a code (`lib/link-codes.ts`), the parent redeems it from their own panel, and
 * `guardianships` records the link.
 */
export const PARENT_INVITE_EXPIRY_DAYS = 7;
