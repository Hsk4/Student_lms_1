import mongoose, { Schema, Document } from "mongoose";

export interface IBook extends Document {
  title: string;
  author?: string;
  courseIds: Schema.Types.ObjectId[];
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course", index: true }],
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

export const Book =
  mongoose.models.Book || mongoose.model<IBook>("Book", bookSchema);
