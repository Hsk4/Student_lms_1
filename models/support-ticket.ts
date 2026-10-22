import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  authorId: Schema.Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  createdBy: Schema.Types.ObjectId;
  subject: string;
  messages: IMessage[];
  state: 'open' | 'escalated' | 'resolved';
  assignedTo?: 'admin' | 'super_admin';
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true },
    messages: [messageSchema],
    state: {
      type: String,
      enum: ['open', 'escalated', 'resolved'],
      default: 'open',
      index: true,
    },
    assignedTo: {
      type: String,
      enum: ['admin', 'super_admin'],
      default: 'admin',
    },
  },
  { timestamps: true }
);

export const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
