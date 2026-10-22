import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion {
  text: string;
  type: 'multiple_choice' | 'short_answer' | 'essay';
  options?: string[];
  correctAnswer?: string;
  points?: number;
}

export interface IQuiz extends Document {
  courseId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  title: string;
  description?: string;
  questions: IQuestion[];
  generatedBy?: 'ai' | 'manual';
  state: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    text: { type: String, required: true },
    type: { type: String, enum: ['multiple_choice', 'short_answer', 'essay'], required: true },
    options: [{ type: String }],
    correctAnswer: { type: String },
    points: { type: Number, default: 1 },
  },
  { _id: false }
);

const quizSchema = new Schema<IQuiz>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    questions: [questionSchema],
    generatedBy: { type: String, enum: ['ai', 'manual'], default: 'manual' },
    state: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  },
  { timestamps: true }
);

export const Quiz = mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', quizSchema);
