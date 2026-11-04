import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole, UserStatus } from "@lms/shared";
import type { TokenVerifier } from "@/middleware/auth";

/**
 * Integration-test helpers: reset the throwaway database, seed rows through the
 * schema (never through product code), and mint fake tokens.
 */

const TABLES = [
  "audit_logs",
  "ticket_messages",
  "support_tickets",
  "attendance_records",
  "attendance_sessions",
  "submissions",
  "assignments",
  "enrollments",
  "classes",
  "meetings",
  "invoices",
  "materials",
  "book_courses",
  "books",
  "courses",
  "levels",
  "subjects",
  "boards",
  "parent_invites",
  "guardianships",
  "student_subjects",
  "access_request_subjects",
  "access_requests",
  "teacher_courses",
  "users",
];

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(", ")} CASCADE`));
}

/**
 * Tokens name an account id; the verifier below maps them back. `clerkId` is the
 * historical column name for that provider-neutral identity string.
 */
export const tokenFor = (clerkId: string) => `test-token-${clerkId}`;

export const testVerifier: TokenVerifier = async (token) => {
  if (!token.startsWith("test-token-")) throw new Error("bad token");
  const clerkId = token.slice("test-token-".length);
  return { clerkId, metadata: {} };
};

type SeedUser = {
  clerkId: string;
  name?: string;
  email?: string;
  role?: UserRole | null;
  status?: UserStatus;
  onboarded?: boolean;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  boardId?: string | null;
  levelId?: string | null;
};

export async function seedUser(input: SeedUser) {
  const [row] = await db
    .insert(users)
    .values({
      clerkId: input.clerkId,
      name: input.name ?? input.clerkId,
      email: input.email ?? `${input.clerkId}@example.com`,
      role: input.role ?? null,
      status: input.status ?? "active",
      onboarded: input.onboarded ?? true,
      rejectedAt: input.rejectedAt ?? null,
      rejectionReason: input.rejectionReason ?? null,
      boardId: input.boardId ?? null,
      levelId: input.levelId ?? null,
    })
    .returning();
  return row;
}

export const authHeader = (clerkId: string) => ({
  Authorization: `Bearer ${tokenFor(clerkId)}`,
});
