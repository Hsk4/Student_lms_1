import mongoose, { Schema, Document } from "mongoose";

export interface ICourse extends Document {
  boardId: Schema.Types.ObjectId;
  levelId: Schema.Types.ObjectId;
  subjectId: Schema.Types.ObjectId;
  medium?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    levelId: {
      type: Schema.Types.ObjectId,
      ref: "Level",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    medium: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// One course per board, level, subject and medium. Empty medium is stored as ''.
courseSchema.index(
  { boardId: 1, levelId: 1, subjectId: 1, medium: 1 },
  { unique: true },
);

export const Course =
  mongoose.models.Course || mongoose.model<ICourse>("Course", courseSchema);
