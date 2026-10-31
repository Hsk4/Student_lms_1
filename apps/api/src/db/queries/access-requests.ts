import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { accessRequestSubjects, accessRequests } from "@/db/schema";
import type { AccessRequest, AccessRequestState, Id } from "@/db/types";

/**
 * Access requests. Postgres-backed.
 *
 * `subjectIds` was an embedded array; it is `access_request_subjects` now. The
 * partial unique index `access_requests_one_open_per_user` replaced the old
 * compound unique index, so "one open request per user" is still a database
 * fact rather than an application convention.
 */

type RequestRow = typeof accessRequests.$inferSelect;

function toAccessRequest(row: RequestRow, subjectIds: Id[]): AccessRequest {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    boardId: row.boardId,
    levelId: row.levelId,
    subjectIds,
    note: row.note,
    requestedRole: row.requestedRole,
    state: row.state,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function subjectsFor(
  requestIds: Id[],
  conn: Tx | typeof db,
): Promise<Map<Id, Id[]>> {
  const map = new Map<Id, Id[]>();
  if (requestIds.length === 0) return map;
  const links = await conn
    .select({
      requestId: accessRequestSubjects.accessRequestId,
      subjectId: accessRequestSubjects.subjectId,
    })
    .from(accessRequestSubjects)
    .where(inArray(accessRequestSubjects.accessRequestId, requestIds));
  for (const link of links) {
    const current = map.get(link.requestId);
    if (current) current.push(link.subjectId);
    else map.set(link.requestId, [link.subjectId]);
  }
  return map;
}

export async function listAccessRequests(
  state: AccessRequestState,
  limit = 200,
  conn: Tx | typeof db = db,
): Promise<AccessRequest[]> {
  const rows = await conn
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.state, state))
    .orderBy(desc(accessRequests.createdAt))
    .limit(limit);
  const subjects = await subjectsFor(
    rows.map((row) => row.id),
    conn,
  );
  return rows.map((row) => toAccessRequest(row, subjects.get(row.id) ?? []));
}

export async function findOpenRequestForUser(
  userId: Id,
  conn: Tx | typeof db = db,
): Promise<AccessRequest | null> {
  const [row] = await conn
    .select()
    .from(accessRequests)
    .where(
      and(eq(accessRequests.userId, userId), eq(accessRequests.state, "open")),
    )
    .limit(1);
  if (!row) return null;
  const subjects = await subjectsFor([row.id], conn);
  return toAccessRequest(row, subjects.get(row.id) ?? []);
}

export async function findRequestById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<AccessRequest | null> {
  const [row] = await conn
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, id))
    .limit(1);
  if (!row) return null;
  const subjects = await subjectsFor([row.id], conn);
  return toAccessRequest(row, subjects.get(row.id) ?? []);
}

export async function countOpenRequests(
  conn: Tx | typeof db = db,
): Promise<number> {
  const rows = await conn
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(eq(accessRequests.state, "open"));
  return rows.length;
}

export async function createAccessRequest(
  input: {
    userId: Id;
    name: string;
    email: string;
    boardId: Id | null;
    levelId: Id | null;
    subjectIds: Id[];
    note: string | null;
    requestedRole: "teacher" | "student" | "parent" | null;
  },
  conn: Tx | typeof db = db,
): Promise<AccessRequest> {
  const [row] = await conn
    .insert(accessRequests)
    .values({
      userId: input.userId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      boardId: input.boardId,
      levelId: input.levelId,
      note: input.note,
      requestedRole: input.requestedRole,
      state: "open",
    })
    .returning();

  const unique = [...new Set(input.subjectIds)];
  if (unique.length > 0) {
    await conn
      .insert(accessRequestSubjects)
      .values(
        unique.map((subjectId) => ({ accessRequestId: row.id, subjectId })),
      )
      .onConflictDoNothing();
  }
  return toAccessRequest(row, unique);
}

export async function setRequestSubjects(
  requestId: Id,
  subjectIds: Id[],
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .delete(accessRequestSubjects)
    .where(eq(accessRequestSubjects.accessRequestId, requestId));
  const unique = [...new Set(subjectIds)];
  if (unique.length === 0) return;
  await conn
    .insert(accessRequestSubjects)
    .values(
      unique.map((subjectId) => ({ accessRequestId: requestId, subjectId })),
    )
    .onConflictDoNothing();
}

export async function decideAccessRequest(
  id: Id,
  input: {
    state: Extract<AccessRequestState, "approved" | "rejected">;
    decidedBy: Id;
    reason: string | null;
  },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(accessRequests)
    .set({
      state: input.state,
      decidedBy: input.decidedBy,
      decidedAt: new Date(),
      reason: input.reason,
    })
    .where(eq(accessRequests.id, id));
}
