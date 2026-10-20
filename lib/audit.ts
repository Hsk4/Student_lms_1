import type mongoose from "mongoose";
import { AuditLog } from "@/models/audit-log";

export interface AuditInput {
  actorId: string | mongoose.Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string | mongoose.Types.ObjectId | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Audit entries are append only. Pass the transaction session when the change
 * is part of a multi-record mutation so the entry commits or rolls back with it.
 */
export async function writeAudit(
  entry: AuditInput,
  session?: mongoose.ClientSession,
): Promise<void> {
  const doc = new AuditLog({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? undefined,
    before: entry.before ?? undefined,
    after: entry.after ?? undefined,
    at: new Date(),
  });

  await doc.save({ session });
}
