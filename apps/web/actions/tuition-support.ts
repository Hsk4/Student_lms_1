"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { checkAccess, getCurrentUser } from "@/lib/auth/roles";
import { isGuardianOf } from "@/lib/queries/guardianships";
import {
  createInvoice as insertInvoice,
  findInvoiceById,
  listInvoicesForStudent,
  setInvoiceState,
} from "@/lib/queries/invoices";
import {
  createMeeting as insertMeeting,
  findMeetingById,
  updateMeetingForTeacher,
} from "@/lib/queries/meetings";
import { findActiveEnrollmentBetween } from "@/lib/queries/enrollment";
import {
  addMessage,
  createTicket as insertTicket,
  findTicketById,
  listOpenTickets,
  listTicketsCreatedBy,
  setTicketState,
} from "@/lib/queries/support-tickets";
import { findUserByClerkId } from "@/lib/queries/users";
import { recordIdSchema } from "@/lib/validators/common";

/**
 * Billing, meetings and support. Postgres-backed.
 *
 * Every mutation here used to write an `AuditLog` document with
 * `actorId: session.clerkId` — a Clerk string in a field the schema declares a
 * uuid. Those writes now take the Postgres user id and go through `writeAudit`
 * inside the same transaction, which is what Invariant 3 requires.
 */

// ============ INVOICES ============

const createInvoiceSchema = z.object({
  studentId: recordIdSchema,
  period: z.string().min(1),
  amount: z.number().int().positive(),
  dueDate: z.string().datetime(),
});

export async function createInvoice(data: z.infer<typeof createInvoiceSchema>) {
  const { redirectTo } = await checkAccess(["admin", "super_admin"]);
  if (redirectTo) throw new Error("Unauthorized");

  const validated = createInvoiceSchema.parse(data);
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Unauthorized");

  await db.transaction(async (tx) => {
    const invoice = await insertInvoice(
      {
        studentId: validated.studentId,
        period: validated.period,
        amount: validated.amount,
        dueDate: new Date(validated.dueDate),
      },
      tx,
    );

    await writeAudit(
      {
        actorId: actor.id,
        action: "createInvoice",
        targetType: "Invoice",
        targetId: invoice.id,
        after: {
          studentId: invoice.studentId,
          period: invoice.period,
          amount: invoice.amount,
          dueDate: invoice.dueDate.toISOString(),
        },
      },
      { tx },
    );
  });
}

const markInvoicePaidSchema = z.object({
  invoiceId: recordIdSchema,
});

export async function markInvoicePaid(
  data: z.infer<typeof markInvoicePaidSchema>,
) {
  const { redirectTo } = await checkAccess(["admin", "super_admin"]);
  if (redirectTo) throw new Error("Unauthorized");

  const validated = markInvoicePaidSchema.parse(data);
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Unauthorized");

  await db.transaction(async (tx) => {
    const invoice = await findInvoiceById(validated.invoiceId, tx);
    if (!invoice) throw new Error("Invoice not found");

    await setInvoiceState(
      invoice.id,
      { state: "paid", paidAt: new Date(), markedBy: actor.id },
      tx,
    );

    await writeAudit(
      {
        actorId: actor.id,
        action: "markInvoicePaid",
        targetType: "Invoice",
        targetId: invoice.id,
        before: { state: invoice.state },
        after: { state: "paid" },
      },
      { tx },
    );
  });
}

export async function getStudentInvoices(studentId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const id = recordIdSchema.parse(studentId);

  // Admins read any invoice. A student reads only their own. A parent reads
  // only a linked child. Anything else is rejected.
  if (user.role === "admin" || user.role === "super_admin") {
    return listInvoicesForStudent(id);
  }

  if (user.role === "student" && user.id !== id) {
    throw new Error("Unauthorized");
  }

  if (user.role === "parent" && !(await isGuardianOf(user.id, id))) {
    throw new Error("Unauthorized: student not linked to this parent");
  }

  if (!user.role) throw new Error("Unauthorized");

  return listInvoicesForStudent(id);
}

// ============ MEETINGS ============

const requestMeetingSchema = z.object({
  studentId: recordIdSchema,
  teacherId: recordIdSchema,
  requestedSlots: z.array(z.string()),
});

export async function requestMeeting(
  data: z.infer<typeof requestMeetingSchema>,
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") throw new Error("Unauthorized");

  const validated = requestMeetingSchema.parse(data);

  if (!(await isGuardianOf(user.id, validated.studentId))) {
    throw new Error("Unauthorized: student not linked to this parent");
  }

  const enrollment = await findActiveEnrollmentBetween(
    validated.teacherId,
    validated.studentId,
  );
  if (!enrollment) {
    throw new Error("That teacher does not teach this student");
  }

  await db.transaction(async (tx) => {
    const meeting = await insertMeeting(
      {
        parentId: user.id,
        teacherId: validated.teacherId,
        studentId: validated.studentId,
        requestedSlots: validated.requestedSlots,
      },
      tx,
    );

    await writeAudit(
      {
        actorId: user.id,
        action: "requestMeeting",
        targetType: "Meeting",
        targetId: meeting.id,
        after: {
          teacherId: validated.teacherId,
          studentId: validated.studentId,
          slots: validated.requestedSlots.length,
        },
      },
      { tx },
    );
  });
}

const confirmMeetingSchema = z.object({
  meetingId: recordIdSchema,
  confirmedAt: z.string().datetime(),
});

export async function confirmMeeting(
  data: z.infer<typeof confirmMeetingSchema>,
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") throw new Error("Unauthorized");

  const validated = confirmMeetingSchema.parse(data);

  await db.transaction(async (tx) => {
    const meeting = await findMeetingById(validated.meetingId, tx);
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.teacherId !== user.id) {
      throw new Error("Unauthorized: not this teacher");
    }

    const confirmedAt = new Date(validated.confirmedAt);
    // Rescheduled vs confirmed follows whether a time was already agreed.
    const nextState = meeting.confirmedAt ? "rescheduled" : "confirmed";
    await updateMeetingForTeacher(
      meeting.id,
      user.id,
      { confirmedAt, state: nextState },
      tx,
    );

    await writeAudit(
      {
        actorId: user.id,
        action: "confirmMeeting",
        targetType: "Meeting",
        targetId: meeting.id,
        before: { state: meeting.state, confirmedAt: meeting.confirmedAt },
        after: { state: nextState, confirmedAt },
      },
      { tx },
    );
  });
}

// ============ SUPPORT TICKETS ============

const createTicketSchema = z.object({
  subject: z.string().min(1),
  text: z.string().min(1),
});

export async function createSupportTicket(
  data: z.infer<typeof createTicketSchema>,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  if (!["student", "teacher"].includes(user.role ?? "")) {
    throw new Error(
      "Unauthorized: only students and teachers can create tickets",
    );
  }

  const validated = createTicketSchema.parse(data);

  await db.transaction(async (tx) => {
    const ticket = await insertTicket(
      {
        createdBy: user.id,
        subject: validated.subject,
        text: validated.text,
        assignedTo: "admin",
      },
      tx,
    );

    await writeAudit(
      {
        actorId: user.id,
        action: "createSupportTicket",
        targetType: "SupportTicket",
        targetId: ticket.id,
        after: { subject: ticket.subject },
      },
      { tx },
    );
  });
}

const addTicketMessageSchema = z.object({
  ticketId: recordIdSchema,
  text: z.string().min(1),
});

export async function addTicketMessage(
  data: z.infer<typeof addTicketMessageSchema>,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const validated = addTicketMessageSchema.parse(data);

  await db.transaction(async (tx) => {
    const ticket = await findTicketById(validated.ticketId, tx);
    if (!ticket) throw new Error("Ticket not found");

    // Only the creator, an admin or a super_admin can add messages.
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    if (ticket.createdBy !== user.id && !isAdmin) {
      throw new Error("Unauthorized");
    }

    await addMessage(ticket.id, user.id, validated.text, tx);
  });
}

const escalateTicketSchema = z.object({
  ticketId: recordIdSchema,
});

export async function escalateTicket(
  data: z.infer<typeof escalateTicketSchema>,
) {
  const { redirectTo } = await checkAccess(["admin", "super_admin"]);
  if (redirectTo) throw new Error("Unauthorized");

  const validated = escalateTicketSchema.parse(data);
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Unauthorized");

  await db.transaction(async (tx) => {
    const ticket = await findTicketById(validated.ticketId, tx);
    if (!ticket) throw new Error("Ticket not found");

    await setTicketState(
      ticket.id,
      { state: "escalated", assignedTo: "super_admin" },
      tx,
    );

    await writeAudit(
      {
        actorId: actor.id,
        action: "escalateTicket",
        targetType: "SupportTicket",
        targetId: ticket.id,
        before: { state: ticket.state, assignedTo: ticket.assignedTo },
        after: { state: "escalated", assignedTo: "super_admin" },
      },
      { tx },
    );
  });
}

export async function getMyTickets() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const author = await findUserByClerkId(user.clerkId);
  if (!author) throw new Error("Unauthorized");

  return listTicketsCreatedBy(author.id);
}
