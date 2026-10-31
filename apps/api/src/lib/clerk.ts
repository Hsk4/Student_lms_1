import { createClerkClient, type ClerkClient } from "@clerk/backend";

/**
 * The single Clerk backend client and the single token verifier.
 *
 * `verifyToken` from `@clerk/backend` validates the bearer token the web client
 * sends. Session-token version 2 keeps custom session claims under `o`, which
 * is where the `metadata` template (`{{user.public_metadata}}`) lands.
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

let cachedClient: ClerkClient | null = null;

export function clerkClient(): ClerkClient {
  if (!cachedClient) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");
    cachedClient = createClerkClient({ secretKey });
  }
  return cachedClient;
}

/** Reads `metadata` from a verified payload, tolerating both token shapes. */
export function metadataOf(payload: Record<string, unknown>): SessionMetadata {
  const direct = payload.metadata as SessionMetadata | undefined;
  const nested = (payload.o as { metadata?: SessionMetadata } | undefined)
    ?.metadata;
  return direct ?? nested ?? {};
}
