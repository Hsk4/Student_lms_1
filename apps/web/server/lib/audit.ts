import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { Id } from "@/lib/types";

/** A Drizzle transaction handle, or the plain client when outside one. */
export type AuditTx = Pick<typeof db, "insert">;

export interface AuditInput {
  actorId: Id;
  action: string;
  targetType: string;
  targetId?: Id | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Audit entries are append only, and always Postgres.
 *
 * There is exactly one backend now, so the `target` union collapsed to `{ tx }`
 * and the Mongo `session` branch is gone. Callers that mutate inside
 * `db.transaction` pass `{ tx }` so the entry commits or rolls back with the
 * change it records — an audit row must never outlive a failed mutation.
 */
export async function writeAudit(
  entry: AuditInput,
  target?: { tx: AuditTx },
): Promise<void> {
  const conn = target?.tx ?? db;
  await conn.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    at: new Date(),
  });
}
