import { desc } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { AuditLog } from "@/lib/types";

/**
 * Audit log reads. Postgres-backed.
 *
 * Writes live in `lib/audit.ts` because they must happen inside the caller's
 * transaction. This module is read-only by design: an audit trail that can be
 * edited is not an audit trail.
 */

type AuditRow = typeof auditLogs.$inferSelect;

function toAuditLog(row: AuditRow): AuditLog {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    before: row.before ?? null,
    after: row.after ?? null,
    at: row.at,
  };
}

export async function listAuditLogs(
  limit = 200,
  conn: Tx | typeof db = db,
): Promise<AuditLog[]> {
  const rows = await conn
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.at))
    .limit(limit);
  return rows.map(toAuditLog);
}
