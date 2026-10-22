import mongoose, { Schema, Document } from "mongoose";

export type ParentInviteState = "sent" | "accepted" | "expired" | "revoked";

/**
 * A guardian link issued by a student.
 *
 * There is no email invitation: the student generates a short code, the parent
 * signs up normally (or signs in), and enters the code in their own panel. This
 * removes the dependency on Clerk's invitation delivery and on the parent
 * having access to any particular inbox. `parentEmail` is kept for records and
 * for the admin repair screen, and is updated to the real account email when
 * the code is redeemed.
 */
export interface IParentInvite extends Document {
  studentId: Schema.Types.ObjectId;
  parentName: string;
  parentEmail: string;
  /** Short human code the parent types in. Unique, uppercase, no lookalikes. */
  code: string;
  state: ParentInviteState;
  expiresAt?: Date;
  acceptedBy?: Schema.Types.ObjectId;
  acceptedAt?: Date;
  /** Failed redemption attempts, used to slow down guessing. */
  attempts?: number;
  lastAttemptAt?: Date;
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
      lowercase: true,
      trim: true,
      default: "",
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    state: {
      type: String,
      enum: ["sent", "accepted", "expired", "revoked"],
      default: "sent",
      index: true,
    },
    expiresAt: { type: Date, index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
  },
  { timestamps: true },
);

parentInviteSchema.index({ parentEmail: 1, state: 1 });

export const ParentInvite =
  mongoose.models.ParentInvite ||
  mongoose.model<IParentInvite>("ParentInvite", parentInviteSchema);
