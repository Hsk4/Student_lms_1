import mongoose, { Schema, Document } from "mongoose";

export type EnrollmentState =
  | "requested"
  | "active"
  | "declined"
  | "cancelled"
  | "ended";

export interface IEnrollment extends Document {
  studentId: Schema.Types.ObjectId;
  teacherId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId;
  classId?: Schema.Types.ObjectId | null;
  state: EnrollmentState;
  requestedAt: Date;
  decidedAt?: Date;
  endReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    classId: { type: Schema.Types.ObjectId, ref: "Class" },
    state: {
      type: String,
      enum: ["requested", "active", "declined", "cancelled", "ended"],
      default: "requested",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    endReason: { type: String },
  },
  { timestamps: true },
);

enrollmentSchema.index({ studentId: 1, state: 1 });
enrollmentSchema.index({ teacherId: 1, state: 1 });

export const Enrollment =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
