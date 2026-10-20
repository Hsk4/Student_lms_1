import mongoose, { Schema, Document } from 'mongoose';

export interface ISubject extends Document {
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Subject = mongoose.models.Subject || mongoose.model<ISubject>('Subject', subjectSchema);
