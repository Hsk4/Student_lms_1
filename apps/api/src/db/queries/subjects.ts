import { asc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { toSubject } from "@/db/mappers";
import { subjects } from "@/db/schema";
import type { Id, Subject } from "@/db/types";

/**
 * Subject reads and writes. Postgres-backed.
 *
 * This is the reference implementation for every migrated model:
 *  - the caller passes either `db` (or nothing) or a `Tx`; the two are
 *    structurally compatible for query building, so one function serves both
 *  - plain objects in, plain objects out; no `_id`, no `lean()`, no `populate()`
 *  - the mapper does the renaming, so nothing here mentions snake_case
 */

/** Every subject, newest-looking order preserved: alphabetical by name. */
export async function listSubjects(
  conn: Tx | typeof db = db,
): Promise<Subject[]> {
  const rows = await conn.select().from(subjects).orderBy(asc(subjects.name));
  return rows.map(toSubject);
}

export async function listActiveSubjects(
  conn: Tx | typeof db = db,
): Promise<Subject[]> {
  const rows = await conn
    .select()
    .from(subjects)
    .where(eq(subjects.active, true))
    .orderBy(asc(subjects.name));
  return rows.map(toSubject);
}

export async function findSubjectById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Subject | null> {
  const [row] = await conn
    .select()
    .from(subjects)
    .where(eq(subjects.id, id))
    .limit(1);
  return row ? toSubject(row) : null;
}

export async function createSubject(
  input: { name: string; slug: string; active: boolean },
  conn: Tx | typeof db = db,
): Promise<Subject> {
  const [row] = await conn
    .insert(subjects)
    .values({
      name: input.name,
      // The validator already lowercases via `slugSchema`; enforcing it here too
      // keeps the column's own contract (lowercase slug) true for all callers.
      slug: input.slug.toLowerCase(),
      active: input.active,
    })
    .returning();
  return toSubject(row);
}

export async function updateSubject(
  id: Id,
  input: { name: string; slug: string; active: boolean },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(subjects)
    .set({
      name: input.name,
      slug: input.slug.toLowerCase(),
      active: input.active,
    })
    .where(eq(subjects.id, id));
}

export async function setSubjectActive(
  id: Id,
  active: boolean,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(subjects).set({ active }).where(eq(subjects.id, id));
}
