import { and, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { boards, guardianships, levels, users } from "@/db/schema";
import type { Id } from "@/db/types";

/**
 * The parent/student link. Postgres-backed.
 *
 * Mongo stored this twice — `student.guardianIds[]` and `parent.childIds[]` —
 * and the two mirrors could drift. Here there is exactly one `guardianships`
 * row per link, with a composite primary key, so a duplicate is impossible and
 * `$addToSet` semantics come for free from `onConflictDoNothing`.
 */

export async function linkParentToStudent(
  parentId: Id,
  studentId: Id,
  options: { markOnboarded?: boolean } = {},
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .insert(guardianships)
    .values({ parentId, studentId })
    .onConflictDoNothing();

  if (options.markOnboarded) {
    await conn
      .update(users)
      .set({ onboarded: true })
      .where(eq(users.id, studentId));
  }
}

export async function unlinkParentFromStudent(
  parentId: Id,
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .delete(guardianships)
    .where(
      and(
        eq(guardianships.parentId, parentId),
        eq(guardianships.studentId, studentId),
      ),
    );
}

/** True when a link row exists. One table, so there is nothing to reconcile. */
export async function isGuardianOf(
  parentId: Id,
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<boolean> {
  const [row] = await conn
    .select({ parentId: guardianships.parentId })
    .from(guardianships)
    .where(
      and(
        eq(guardianships.parentId, parentId),
        eq(guardianships.studentId, studentId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listStudentIdsForParent(
  parentId: Id,
  conn: Tx | typeof db = db,
): Promise<Id[]> {
  const rows = await conn
    .select({ studentId: guardianships.studentId })
    .from(guardianships)
    .where(eq(guardianships.parentId, parentId));
  return rows.map((row) => row.studentId);
}

export async function listParentIdsForStudent(
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<Id[]> {
  const rows = await conn
    .select({ parentId: guardianships.parentId })
    .from(guardianships)
    .where(eq(guardianships.studentId, studentId));
  return rows.map((row) => row.parentId);
}

export type ChildRow = {
  id: Id;
  name: string;
  email: string;
  boardName: string | null;
  levelName: string | null;
};

/**
 * Students linked to a parent. Two LEFT JOINs replace the old `populate()`
 * calls, so this is one round trip instead of three.
 */
export async function listGuardianChildren(
  parentId: Id,
  conn: Tx | typeof db = db,
): Promise<ChildRow[]> {
  const rows = await conn
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      boardName: boards.name,
      levelName: levels.name,
    })
    .from(guardianships)
    .innerJoin(users, eq(users.id, guardianships.studentId))
    .leftJoin(boards, eq(boards.id, users.boardId))
    .leftJoin(levels, eq(levels.id, users.levelId))
    .where(
      and(
        eq(guardianships.parentId, parentId),
        eq(users.role, "student"),
        eq(users.status, "active"),
      ),
    );

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
