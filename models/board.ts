import mongoose, { Schema, Document } from 'mongoose';

export interface IBoard extends Document {
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const boardSchema = new Schema<IBoard>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Board = mongoose.models.Board || mongoose.model<IBoard>('Board', boardSchema);
