import mongoose, { Schema, Document } from 'mongoose';

export interface IMaterial extends Document {
  courseId: Schema.Types.ObjectId;
  title: string;
  type: 'notes' | 'past_paper' | 'worksheet' | 'other';
  fileUrl: string;
  uploadedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['notes', 'past_paper', 'worksheet', 'other'],
      default: 'other',
    },
    fileUrl: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Material = mongoose.models.Material || mongoose.model<IMaterial>('Material', materialSchema);
