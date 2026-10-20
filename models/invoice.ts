import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
  studentId: Schema.Types.ObjectId;
  period: string;
  amount: number;
  dueDate: Date;
  state: 'unpaid' | 'paid' | 'void';
  paidAt?: Date;
  markedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    state: {
      type: String,
      enum: ['unpaid', 'paid', 'void'],
      default: 'unpaid',
      index: true,
    },
    paidAt: { type: Date },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', invoiceSchema);
