import mongoose, { Schema, Document } from "mongoose";

export interface IAccessRequest extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  email: string;
  boardId?: Schema.Types.ObjectId | null;
  levelId?: Schema.Types.ObjectId | null;
  subjectIds: Schema.Types.ObjectId[];
  note?: string;
  state: "open" | "approved" | "rejected";
  decidedBy?: Schema.Types.ObjectId;
  decidedAt?: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    boardId: { type: Schema.Types.ObjectId, ref: "Board" },
    levelId: { type: Schema.Types.ObjectId, ref: "Level" },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    note: { type: String },
    state: {
      type: String,
      enum: ["open", "approved", "rejected"],
      default: "open",
      index: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    reason: { type: String },
  },
  { timestamps: true },
);

// One open request at a time per user.
accessRequestSchema.index(
  { userId: 1, state: 1 },
  { unique: true, partialFilterExpression: { state: "open" } },
);

export const AccessRequest =
  mongoose.models.AccessRequest ||
  mongoose.model<IAccessRequest>("AccessRequest", accessRequestSchema);
