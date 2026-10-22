'use server';

import { connectDB, withTransaction } from '@/lib/db';
import { Invoice } from '@/models/invoice';
import { Meeting } from '@/models/meeting';
import { SupportTicket } from '@/models/support-ticket';
import { User } from '@/models/user';
import { Enrollment } from '@/models/enrollment';
import { AuditLog } from '@/models/audit-log';
import { checkAccess, getSessionUser, getCurrentUser } from '@/lib/auth/roles';
import { isGuardianOf } from '@/lib/guardians';
import { z } from 'zod';

// ============ INVOICES ============

const createInvoiceSchema = z.object({
  studentId: z.string().min(1),
  period: z.string().min(1),
  amount: z.number().int().positive(),
  dueDate: z.string().datetime(),
});

export async function createInvoice(data: z.infer<typeof createInvoiceSchema>) {
  const { redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) throw new Error('Unauthorized');

  const validated = createInvoiceSchema.parse(data);
  const session = await getSessionUser();

  await connectDB();

  await withTransaction(async (session_db) => {
    const invoice = new Invoice({
      studentId: validated.studentId,
      period: validated.period,
      amount: validated.amount,
      dueDate: new Date(validated.dueDate),
    });

    await invoice.save({ session: session_db });

    const auditEntry = new AuditLog({
      actorId: session?.clerkId,
      action: 'createInvoice',
      targetType: 'Invoice',
      targetId: invoice._id,
      after: invoice.toObject(),
      at: new Date(),
    });

    await auditEntry.save({ session: session_db });
  });
}

const markInvoicePaidSchema = z.object({
  invoiceId: z.string().min(1),
});

export async function markInvoicePaid(data: z.infer<typeof markInvoicePaidSchema>) {
  const { redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) throw new Error('Unauthorized');

  const validated = markInvoicePaidSchema.parse(data);
  const session = await getSessionUser();

  await connectDB();

  await withTransaction(async (session_db) => {
    const invoice = await Invoice.findById(validated.invoiceId).session(session_db);

    if (!invoice) throw new Error('Invoice not found');

    const before = { state: invoice.state };

    invoice.state = 'paid';
    invoice.paidAt = new Date();
    invoice.markedBy = session?.clerkId;

    await invoice.save({ session: session_db });

    const auditEntry = new AuditLog({
      actorId: session?.clerkId,
      action: 'markInvoicePaid',
      targetType: 'Invoice',
      targetId: invoice._id,
      before,
      after: { state: 'paid' },
      at: new Date(),
    });

    await auditEntry.save({ session: session_db });
  });
}

export async function getStudentInvoices(studentId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await connectDB();

  // Admins read any invoice. A student reads only their own. A parent reads
  // only a linked child. Anything else is rejected.
  if (['admin', 'super_admin'].includes(user.role ?? '')) {
    return Invoice.find({ studentId }).sort({ dueDate: -1 }).lean();
  }

  if (user.role === 'student' && user.id !== studentId) {
    throw new Error('Unauthorized');
  }

  if (user.role === 'parent' && !(await isGuardianOf(user.id, studentId))) {
    throw new Error('Unauthorized: student not linked to this parent');
  }

  return Invoice.find({ studentId }).sort({ dueDate: -1 }).lean();
}

// ============ MEETINGS ============

const requestMeetingSchema = z.object({
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  requestedSlots: z.array(z.string()),
});

export async function requestMeeting(data: z.infer<typeof requestMeetingSchema>) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'parent') throw new Error('Unauthorized');

  const validated = requestMeetingSchema.parse(data);

  await connectDB();

  if (!(await isGuardianOf(user.id, validated.studentId))) {
    throw new Error('Unauthorized: student not linked to this parent');
  }

  const enrollment = await Enrollment.findOne({
    studentId: validated.studentId,
    teacherId: validated.teacherId,
    state: 'active',
  })
    .select('_id')
    .lean();
  if (!enrollment) {
    throw new Error('That teacher does not teach this student');
  }

  await withTransaction(async (session_db) => {
    const meeting = new Meeting({
      parentId: user.id,
      teacherId: validated.teacherId,
      studentId: validated.studentId,
      requestedSlots: validated.requestedSlots,
      state: 'requested',
    });

    await meeting.save({ session: session_db });
  });
}

const confirmMeetingSchema = z.object({
  meetingId: z.string().min(1),
  confirmedAt: z.string().datetime(),
});

export async function confirmMeeting(data: z.infer<typeof confirmMeetingSchema>) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'teacher') throw new Error('Unauthorized');

  const validated = confirmMeetingSchema.parse(data);

  await connectDB();

  const teacher = await User.findOne({ clerkId: user.clerkId }).lean();

  await withTransaction(async (session_db) => {
    const meeting = await Meeting.findById(validated.meetingId).session(session_db);

    if (!meeting) throw new Error('Meeting not found');

    if (String(meeting.teacherId) !== String(teacher?._id)) {
      throw new Error('Unauthorized: not this teacher');
    }

    meeting.state = 'confirmed';
    meeting.confirmedAt = new Date(validated.confirmedAt);

    await meeting.save({ session: session_db });
  });
}

// ============ SUPPORT TICKETS ============

const createTicketSchema = z.object({
  subject: z.string().min(1),
  text: z.string().min(1),
});

export async function createSupportTicket(data: z.infer<typeof createTicketSchema>) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (!['student', 'teacher'].includes(user.role || '')) {
    throw new Error('Unauthorized: only students and teachers can create tickets');
  }

  const validated = createTicketSchema.parse(data);

  await connectDB();

  const author = await User.findOne({ clerkId: user.clerkId }).lean();

  await withTransaction(async (session_db) => {
    const ticket = new SupportTicket({
      createdBy: author?._id,
      subject: validated.subject,
      messages: [
        {
          authorId: author?._id,
          text: validated.text,
          createdAt: new Date(),
        },
      ],
      state: 'open',
      assignedTo: 'admin',
    });

    await ticket.save({ session: session_db });
  });
}

const addTicketMessageSchema = z.object({
  ticketId: z.string().min(1),
  text: z.string().min(1),
});

export async function addTicketMessage(data: z.infer<typeof addTicketMessageSchema>) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const validated = addTicketMessageSchema.parse(data);

  await connectDB();

  const author = await User.findOne({ clerkId: user.clerkId }).lean();

  await withTransaction(async (session_db) => {
    const ticket = await SupportTicket.findById(validated.ticketId).session(session_db);

    if (!ticket) throw new Error('Ticket not found');

    // Only creator, admin, or super_admin can add messages
    if (
      String(ticket.createdBy) !== String(author?._id) &&
      !['admin', 'super_admin'].includes(user.role || '')
    ) {
      throw new Error('Unauthorized');
    }

    ticket.messages.push({
      authorId: (author?._id ?? ticket.createdBy) as typeof ticket.createdBy,
      text: validated.text,
      createdAt: new Date(),
    });
    await ticket.save({ session: session_db });
  });
}

const escalateTicketSchema = z.object({
  ticketId: z.string().min(1),
});

export async function escalateTicket(data: z.infer<typeof escalateTicketSchema>) {
  const { redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) throw new Error('Unauthorized');

  const validated = escalateTicketSchema.parse(data);

  await connectDB();

  await withTransaction(async (session_db) => {
    const ticket = await SupportTicket.findById(validated.ticketId).session(session_db);

    if (!ticket) throw new Error('Ticket not found');

    ticket.state = 'escalated';
    ticket.assignedTo = 'super_admin';

    await ticket.save({ session: session_db });
  });
}

export async function getAdminTickets() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized');
  }

  await connectDB();

  const filter: Record<string, unknown> = { state: { $ne: 'resolved' } };

  if (user.role === 'admin') {
    filter.assignedTo = 'admin';
  }

  return SupportTicket.find(filter)
    .populate('createdBy', 'name email')
    .populate('messages.authorId', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getMyTickets() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await connectDB();

  const author = await User.findOne({ clerkId: user.clerkId }).lean();

  return SupportTicket.find({ createdBy: author?._id })
    .populate('messages.authorId', 'name')
    .sort({ createdAt: -1 })
    .lean();
}
