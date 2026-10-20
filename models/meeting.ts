import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  parentId: Schema.Types.ObjectId;
  teacherId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  requestedSlots?: string[];
  confirmedAt?: Date;
  state: 'requested' | 'confirmed' | 'rescheduled' | 'cancelled' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedSlots: [{ type: String }],
    confirmedAt: { type: Date },
    state: {
      type: String,
      enum: ['requested', 'confirmed', 'rescheduled', 'cancelled', 'done'],
      default: 'requested',
      index: true,
    },
  },
  { timestamps: true }
);

export const Meeting = mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', meetingSchema);
