/**
 * Legacy compatibility stub left behind by the previous hosted-auth migration.
 * The API now verifies local JWTs directly in `src/middleware/auth.ts`.
 */

export interface SessionMetadata {
  role?: string | null;
  status?: string;
  onboarded?: boolean;
}

export interface VerifiedSession {
  clerkId: string;
  metadata: SessionMetadata;
}

export function clerkClient(): never {
  throw new Error("Hosted auth provider support was removed; use local JWT auth instead.");
}

export function metadataOf(): SessionMetadata {
  return {};
}
