import mongoose, { Schema, Document } from "mongoose";

export type ClassState = "current" | "past";

export interface IClass extends Document {
  teacherId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId;
  name: string;
  schedule?: string;
  state: ClassState;
  startsOn?: Date;
  endsOn?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
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
    name: { type: String, required: true, trim: true },
    schedule: { type: String, trim: true },
    state: {
      type: String,
      enum: ["current", "past"],
      default: "current",
      index: true,
    },
    startsOn: { type: Date },
    endsOn: { type: Date },
  },
  { timestamps: true },
);

export const Class =
  mongoose.models.Class || mongoose.model<IClass>("Class", classSchema);
