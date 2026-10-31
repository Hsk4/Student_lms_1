import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { parentInvites, users } from "@/db/schema";
import type { Id, ParentInvite, ParentInviteState } from "@/lib/types";

/**
 * Parent invites. Postgres-backed.
 *
 * `attempts` is incremented in SQL (`attempts + 1`), never read-then-written, so
 * two concurrent redemptions cannot lose a count. The `code` column is unique
 * and CHECK-uppercase, which makes `uniqueLinkCode`'s retry loop a convenience
 * rather than the actual safety net.
 */

type InviteRow = typeof parentInvites.$inferSelect;

export function toParentInvite(row: InviteRow): ParentInvite {
  return {
    id: row.id,
    studentId: row.studentId,
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    code: row.code,
    state: row.state,
    expiresAt: row.expiresAt,
    acceptedBy: row.acceptedBy,
    acceptedAt: row.acceptedAt,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findInviteByCode(
  code: string,
  conn: Tx | typeof db = db,
): Promise<ParentInvite | null> {
  const [row] = await conn
    .select()
    .from(parentInvites)
    .where(eq(parentInvites.code, code))
    .limit(1);
  return row ? toParentInvite(row) : null;
}

export async function findInviteById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<ParentInvite | null> {
  const [row] = await conn
    .select()
    .from(parentInvites)
    .where(eq(parentInvites.id, id))
    .limit(1);
  return row ? toParentInvite(row) : null;
}

export async function codeExists(
  code: string,
  conn: Tx | typeof db = db,
): Promise<boolean> {
  const [row] = await conn
    .select({ id: parentInvites.id })
    .from(parentInvites)
    .where(eq(parentInvites.code, code))
    .limit(1);
  return Boolean(row);
}

export async function listInvitesForStudent(
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<ParentInvite[]> {
  const rows = await conn
    .select()
    .from(parentInvites)
    .where(eq(parentInvites.studentId, studentId))
    .orderBy(desc(parentInvites.createdAt));
  return rows.map(toParentInvite);
}

export async function listInvitesByState(
  state: ParentInviteState,
  conn: Tx | typeof db = db,
): Promise<ParentInvite[]> {
  const rows = await conn
    .select()
    .from(parentInvites)
    .where(eq(parentInvites.state, state))
    .orderBy(desc(parentInvites.createdAt));
  return rows.map(toParentInvite);
}

/** One row per invite with the student's name/email joined in SQL. */
export type ParentInviteRow = {
  id: Id;
  studentId: Id;
  studentName: string;
  studentEmail: string;
  parentName: string;
  parentEmail: string;
  code: string;
  state: ParentInviteState;
  expiresAt: Date | null;
  createdAt: Date;
  acceptedAt: Date | null;
};

/**
 * Admin table: every invite, newest first. This replaces
 * `ParentInvite.find().populate('studentId', 'name email')` — `populate` became a
 * `left join` because `parent_invites.student_id` is a real foreign key.
 */
export async function listInvitesWithStudent(
  conn: Tx | typeof db = db,
): Promise<ParentInviteRow[]> {
  const rows = await conn
    .select({
      id: parentInvites.id,
      studentId: parentInvites.studentId,
      studentName: users.name,
      studentEmail: users.email,
      parentName: parentInvites.parentName,
      parentEmail: parentInvites.parentEmail,
      code: parentInvites.code,
      state: parentInvites.state,
      expiresAt: parentInvites.expiresAt,
      createdAt: parentInvites.createdAt,
      acceptedAt: parentInvites.acceptedAt,
    })
    .from(parentInvites)
    .leftJoin(users, eq(users.id, parentInvites.studentId))
    .orderBy(desc(parentInvites.createdAt));

  return rows.map((row) => ({
    ...row,
    studentName: row.studentName ?? "Unknown",
    studentEmail: row.studentEmail ?? "",
  }));
}

export async function createInvite(
  input: {
    studentId: Id;
    parentName: string;
    parentEmail: string;
    code: string;
    expiresAt: Date | null;
  },
  conn: Tx | typeof db = db,
): Promise<ParentInvite> {
  const [row] = await conn
    .insert(parentInvites)
    .values({
      studentId: input.studentId,
      parentName: input.parentName,
      parentEmail: input.parentEmail.trim().toLowerCase(),
      code: input.code,
      state: "sent",
      expiresAt: input.expiresAt,
    })
    .returning();
  return toParentInvite(row);
}

/** Atomic counter bump — see the note at the top of the module. */
export async function recordFailedAttempt(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(parentInvites)
    .set({
      attempts: sql`${parentInvites.attempts} + 1`,
      lastAttemptAt: new Date(),
    })
    .where(eq(parentInvites.id, id));
}

export async function acceptInvite(
  id: Id,
  acceptedBy: Id,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(parentInvites)
    .set({ state: "accepted", acceptedBy, acceptedAt: new Date() })
    .where(eq(parentInvites.id, id));
}

export async function setInviteState(
  id: Id,
  state: ParentInviteState,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(parentInvites)
    .set({ state })
    .where(eq(parentInvites.id, id));
}

/** Live invites only: state `sent` and not past `expires_at`. */
export async function listLiveInvitesForStudent(
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<ParentInvite[]> {
  const rows = await conn
    .select()
    .from(parentInvites)
    .where(
      and(
        eq(parentInvites.studentId, studentId),
        eq(parentInvites.state, "sent"),
        sql`(${parentInvites.expiresAt} IS NULL OR ${parentInvites.expiresAt} > now())`,
      ),
    )
    .orderBy(desc(parentInvites.createdAt));
  return rows.map(toParentInvite);
}
