import { and, desc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { toMaterial } from "@/db/mappers";
import { materials } from "@/db/schema";
import type { Id, Material, MaterialType } from "@/db/types";

/**
 * Material reads and writes. Postgres-backed.
 *
 * `type` is a real Postgres enum, so an invalid value fails at the driver with a
 * `22P02` before any application code sees it. The Zod schema still guards the
 * form, because a friendly message beats a driver error.
 */

export async function listMaterialsForCourse(
  courseId: Id,
  conn: Tx | typeof db = db,
): Promise<Material[]> {
  const rows = await conn
    .select()
    .from(materials)
    .where(eq(materials.courseId, courseId))
    .orderBy(desc(materials.createdAt));
  return rows.map(toMaterial);
}

export async function findMaterialById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Material | null> {
  const [row] = await conn
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  return row ? toMaterial(row) : null;
}

/** Everything a course offers, filtered to one kind — the "past papers" tab. */
export async function listMaterialsByType(
  courseId: Id,
  type: MaterialType,
  conn: Tx | typeof db = db,
): Promise<Material[]> {
  const rows = await conn
    .select()
    .from(materials)
    .where(and(eq(materials.courseId, courseId), eq(materials.type, type)))
    .orderBy(desc(materials.createdAt));
  return rows.map(toMaterial);
}

export async function createMaterial(
  input: {
    courseId: Id;
    title: string;
    type: MaterialType;
    fileUrl: string;
    uploadedBy: Id;
  },
  conn: Tx | typeof db = db,
): Promise<Material> {
  const [row] = await conn
    .insert(materials)
    .values({
      courseId: input.courseId,
      title: input.title,
      type: input.type,
      fileUrl: input.fileUrl,
      uploadedBy: input.uploadedBy,
    })
    .returning();
  return toMaterial(row);
}

export async function deleteMaterial(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.delete(materials).where(eq(materials.id, id));
}
