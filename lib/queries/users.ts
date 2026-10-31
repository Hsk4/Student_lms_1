import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { users } from "@/db/schema";
import type { Id, Student, User, UserRole, UserStatus } from "@/lib/types";

/**
 * User reads and writes. Postgres-backed.
 *
 * The Mongoose model kept the student profile in a nested `student` sub-object
 * with `guardianIds` and `subjectIds` arrays. In Postgres the profile is two
 * columns on the row (`board_id`, `level_id`) and the arrays are the
 * `guardianships` / `student_subjects` tables, so `toStudent` re-shapes the two
 * columns into the `student` key the pages still read.
 */

type UserRow = typeof users.$inferSelect;

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    onboarded: row.onboarded,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** User + the flattened student profile, in the nested shape the UI expects. */
export function toStudent(row: UserRow): Student {
  return {
    ...toUser(row),
    student: { boardId: row.boardId, levelId: row.levelId },
  };
}

export async function findUserByClerkId(
  clerkId: string,
  conn: Tx | typeof db = db,
): Promise<Student | null> {
  const [row] = await conn
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row ? toStudent(row) : null;
}

export async function findUserById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Student | null> {
  const [row] = await conn
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ? toStudent(row) : null;
}

export async function findUserByEmail(
  email: string,
  conn: Tx | typeof db = db,
): Promise<Student | null> {
  const [row] = await conn
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ? toStudent(row) : null;
}

export async function listUsersByRole(
  role: UserRole,
  filter: { status?: UserStatus } = {},
  conn: Tx | typeof db = db,
): Promise<User[]> {
  const where =
    filter.status === undefined
      ? eq(users.role, role)
      : and(eq(users.role, role), eq(users.status, filter.status));
  const rows = await conn.select().from(users).where(where);
  return rows.map(toUser);
}

export async function listUsersByStatus(
  status: UserStatus,
  limit = 200,
  conn: Tx | typeof db = db,
): Promise<User[]> {
  const rows = await conn
    .select()
    .from(users)
    .where(eq(users.status, status))
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map(toUser);
}

/**
 * Count users matching a filter, without loading the rows.
 *
 * The list pages show "N users" next to the title; `listAllUsers()` is capped at
 * 200 and would report the page size, not the total.
 */
export async function countUsers(
  filter: { status?: string; role?: string; q?: string } = {},
  conn: Tx | typeof db = db,
): Promise<number> {
  const where = userFilter(filter);
  const [row] = await conn
    .select({ value: count() })
    .from(users)
    .where(where.length ? and(...where) : undefined);
  return row?.value ?? 0;
}

/** Shared WHERE fragments so the list and the count cannot drift apart. */
function userFilter(filter: { status?: string; role?: string; q?: string }): SQL[] {
  return [
    filter.status ? eq(users.status, filter.status as UserStatus) : undefined,
    filter.role ? eq(users.role, filter.role as UserRole) : undefined,
    // Was a case-insensitive RegExp in Mongo; `ilike` is the SQL equivalent and
    // needs no backslash-escaping, which the Mongo version had to do by hand.
    filter.q
      ? or(
          ilike(users.name, `%${filter.q}%`),
          ilike(users.email, `%${filter.q}%`),
        )
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined);
}

export async function listAllUsers(
  filter: { status?: string; role?: string; q?: string } = {},
  limit = 200,
  conn: Tx | typeof db = db,
): Promise<Student[]> {
  const where = userFilter(filter);

  const rows = await conn
    .select()
    .from(users)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map(toStudent);
}

export async function listUsersByIds(
  ids: Id[],
  conn: Tx | typeof db = db,
): Promise<User[]> {
  if (ids.length === 0) return [];
  const rows = await conn.select().from(users).where(inArray(users.id, ids));
  return rows.map(toUser);
}

export async function createUser(
  input: {
    clerkId: string;
    email: string;
    name: string;
    role?: UserRole | null;
    status?: UserStatus;
    onboarded?: boolean;
    boardId?: Id | null;
    levelId?: Id | null;
  },
  conn: Tx | typeof db = db,
): Promise<Student> {
  const [row] = await conn
    .insert(users)
    .values({
      clerkId: input.clerkId,
      // The column has a CHECK that it is lowercase; normalize here so the
      // constraint is a backstop rather than a surprise 23514.
      email: input.email.trim().toLowerCase(),
      name: input.name,
      role: input.role ?? null,
      status: input.status ?? "pending",
      onboarded: input.onboarded ?? false,
      boardId: input.boardId ?? null,
      levelId: input.levelId ?? null,
    })
    .returning();
  return toStudent(row);
}

export async function updateUser(
  id: Id,
  input: Partial<{
    email: string;
    name: string;
    role: UserRole | null;
    status: UserStatus;
    onboarded: boolean;
    boardId: Id | null;
    levelId: Id | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
  }>,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(users)
    .set({
      ...input,
      ...(input.email === undefined
        ? {}
        : { email: input.email.trim().toLowerCase() }),
    })
    .where(eq(users.id, id));
}

export async function deleteUsersNotIn(
  clerkIds: string[],
  conn: Tx | typeof db = db,
): Promise<Id[]> {
  const doomed = await conn
    .select({ id: users.id })
    .from(users)
    .where(
      clerkIds.length === 0 ? undefined : notInArray(users.clerkId, clerkIds),
    );
  if (doomed.length === 0) return [];
  await conn.delete(users).where(
    inArray(
      users.id,
      doomed.map((row) => row.id),
    ),
  );
  return doomed.map((row) => row.id);
}
