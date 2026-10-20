import mongoose, { Schema, Document } from 'mongoose';

export interface ILevel extends Document {
  name: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const levelSchema = new Schema<ILevel>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    order: { type: Number, required: true, unique: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Level = mongoose.models.Level || mongoose.model<ILevel>('Level', levelSchema);
