import mongoose, { Schema, Document } from "mongoose";

export interface ISubmission extends Document {
  assignmentId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  text?: string;
  fileUrl?: string;
  submittedAt: Date;
  score?: number | null;
  feedback?: string;
  gradedBy?: Schema.Types.ObjectId;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: { type: String },
    fileUrl: { type: String },
    submittedAt: { type: Date, default: Date.now },
    score: { type: Number, min: 0, max: 100, default: null },
    feedback: { type: String },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gradedAt: { type: Date },
  },
  { timestamps: true },
);

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const Submission =
  mongoose.models.Submission ||
  mongoose.model<ISubmission>("Submission", submissionSchema);
