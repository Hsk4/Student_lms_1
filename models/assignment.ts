import mongoose, { Schema, Document } from "mongoose";

export interface IAssignment extends Document {
  courseId: Schema.Types.ObjectId;
  teacherId: Schema.Types.ObjectId;
  classId?: Schema.Types.ObjectId | null;
  enrollmentId?: Schema.Types.ObjectId | null;
  title: string;
  description?: string;
  dueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    dueAt: { type: Date },
  },
  { timestamps: true },
);

assignmentSchema.pre("validate", function validateTarget() {
  if (Boolean(this.classId) === Boolean(this.enrollmentId)) {
    throw new Error("An assignment needs exactly one of classId or enrollmentId");
  }
});

export const Assignment =
  mongoose.models.Assignment ||
  mongoose.model<IAssignment>("Assignment", assignmentSchema);
