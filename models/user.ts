import mongoose, { Schema, Document } from "mongoose";

export type UserRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | null;
export type UserStatus = "pending" | "active" | "rejected" | "suspended";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  onboarded: boolean;
  rejectedAt?: Date;
  rejectionReason?: string;
  student?: {
    boardId?: Schema.Types.ObjectId;
    levelId?: Schema.Types.ObjectId;
    subjectIds?: Schema.Types.ObjectId[];
    guardianIds?: Schema.Types.ObjectId[];
  };
  teacher?: {
    courseIds?: Schema.Types.ObjectId[];
  };
  /**
   * Parent side of the guardian relation. The child's `student.guardianIds` is
   * the source of truth; this mirror lets a parent list its children without a
   * collection scan and keeps both directions in step.
   */
  parent?: {
    childIds?: Schema.Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "admin", "teacher", "student", "parent", null],
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    onboarded: { type: Boolean, default: false },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    student: {
      boardId: { type: Schema.Types.ObjectId, ref: "Board" },
      levelId: { type: Schema.Types.ObjectId, ref: "Level" },
      subjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
      guardianIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    teacher: {
      courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    },
    parent: {
      childIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
  },
  { timestamps: true },
);

userSchema.index({ "student.guardianIds": 1 });
userSchema.index({ "parent.childIds": 1 });

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
