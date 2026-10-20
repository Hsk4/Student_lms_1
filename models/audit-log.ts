import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  actorId: Schema.Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: Schema.Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
