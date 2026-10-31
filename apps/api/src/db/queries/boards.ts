import { asc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { toBoard } from "@/db/mappers";
import { boards } from "@/db/schema";
import type { Board, Id } from "@/db/types";

/**
 * Board reads and writes. Postgres-backed.
 *
 * Follows the `lib/queries/subjects.ts` contract: `conn` is `db` or a `Tx`, the
 * mapper owns the renaming, and nothing here mentions `_id`, `lean()` or Mongo.
 */

export async function listBoards(conn: Tx | typeof db = db): Promise<Board[]> {
  const rows = await conn.select().from(boards).orderBy(asc(boards.name));
  return rows.map(toBoard);
}

export async function listActiveBoards(
  conn: Tx | typeof db = db,
): Promise<Board[]> {
  const rows = await conn
    .select()
    .from(boards)
    .where(eq(boards.active, true))
    .orderBy(asc(boards.name));
  return rows.map(toBoard);
}

export async function findBoardById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Board | null> {
  const [row] = await conn
    .select()
    .from(boards)
    .where(eq(boards.id, id))
    .limit(1);
  return row ? toBoard(row) : null;
}

export async function createBoard(
  input: { name: string; slug: string; active: boolean },
  conn: Tx | typeof db = db,
): Promise<Board> {
  const [row] = await conn
    .insert(boards)
    .values({
      name: input.name,
      slug: input.slug.toLowerCase(),
      active: input.active,
    })
    .returning();
  return toBoard(row);
}

export async function updateBoard(
  id: Id,
  input: { name: string; slug: string; active: boolean },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(boards)
    .set({
      name: input.name,
      slug: input.slug.toLowerCase(),
      active: input.active,
    })
    .where(eq(boards.id, id));
}

export async function setBoardActive(
  id: Id,
  active: boolean,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(boards).set({ active }).where(eq(boards.id, id));
}
