import { asc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { toLevel } from "@/db/mappers";
import { levels } from "@/db/schema";
import type { Id, Level } from "@/db/types";

/**
 * Level reads and writes. Postgres-backed.
 *
 * `order` is unique in the schema, so two levels sharing a number surface as a
 * `23505` unique violation — classify it with `isUniqueViolation` in the action,
 * never with a Mongo-style `code === 11000` check.
 */

export async function listLevels(conn: Tx | typeof db = db): Promise<Level[]> {
  const rows = await conn.select().from(levels).orderBy(asc(levels.order));
  return rows.map(toLevel);
}

export async function listActiveLevels(
  conn: Tx | typeof db = db,
): Promise<Level[]> {
  const rows = await conn
    .select()
    .from(levels)
    .where(eq(levels.active, true))
    .orderBy(asc(levels.order));
  return rows.map(toLevel);
}

export async function findLevelById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Level | null> {
  const [row] = await conn
    .select()
    .from(levels)
    .where(eq(levels.id, id))
    .limit(1);
  return row ? toLevel(row) : null;
}

export async function createLevel(
  input: { name: string; order: number; active: boolean },
  conn: Tx | typeof db = db,
): Promise<Level> {
  const [row] = await conn
    .insert(levels)
    .values({
      name: input.name,
      order: input.order,
      active: input.active,
    })
    .returning();
  return toLevel(row);
}

export async function updateLevel(
  id: Id,
  input: { name: string; order: number; active: boolean },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(levels)
    .set({ name: input.name, order: input.order, active: input.active })
    .where(eq(levels.id, id));
}

export async function setLevelActive(
  id: Id,
  active: boolean,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(levels).set({ active }).where(eq(levels.id, id));
}
