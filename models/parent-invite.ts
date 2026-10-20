import mongoose, { Schema, Document } from "mongoose";

export type ParentInviteState = "sent" | "accepted" | "expired" | "revoked";

export interface IParentInvite extends Document {
  studentId: Schema.Types.ObjectId;
  parentName: string;
  parentEmail: string;
  clerkInvitationId: string;
  state: ParentInviteState;
  expiresAt?: Date;
  acceptedBy?: Schema.Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const parentInviteSchema = new Schema<IParentInvite>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentName: { type: String, required: true, trim: true },
    parentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    clerkInvitationId: { type: String, required: true, unique: true },
    state: { type: String, enum: ["sent", "accepted", "expired", "revoked"], default: "sent", index: true },
    expiresAt: { type: Date, index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
  },
  { timestamps: true },
);

parentInviteSchema.index({ parentEmail: 1, state: 1 });

export const ParentInvite =
  mongoose.models.ParentInvite ||
  mongoose.model<IParentInvite>("ParentInvite", parentInviteSchema);
