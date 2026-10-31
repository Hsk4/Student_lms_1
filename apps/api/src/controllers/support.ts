import type { Request } from "express";
import { z } from "zod";
import { recordIdSchema } from "@lms/shared";
import { db } from "@/db";
import { forbidden, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import {
  addMessage,
  authorNames,
  createTicket,
  findTicketById,
  listOpenTickets,
  listTicketsCreatedBy,
  setTicketState,
} from "@/db/queries/support-tickets";

/** Support tickets: student/teacher -> admin, escalatable to the super admin. */

/** `POST /api/v1/support/tickets` */
export async function createSupportTicket(req: Request) {
  const actor = actorOf(req);
  if (actor.role !== "student" && actor.role !== "teacher") {
    throw forbidden(
      "Unauthorized: only students and teachers can create tickets",
    );
  }
  const input = z
    .object({ subject: z.string().min(1), text: z.string().min(1) })
    .parse(req.body);

  await db.transaction(async (tx) => {
    const ticket = await createTicket(
      {
        createdBy: actor.id,
        subject: input.subject,
        text: input.text,
        assignedTo: "admin",
      },
      tx,
    );
    await writeAudit(
      {
        actorId: actor.id,
        action: "createSupportTicket",
        targetType: "SupportTicket",
        targetId: ticket.id,
        after: { subject: ticket.subject },
      },
      { tx },
    );
  });
}

/** `POST /api/v1/support/tickets/:id/messages` — the creator, or an admin. */
export async function addTicketMessage(req: Request) {
  const actor = actorOf(req);
  const ticketId = recordIdSchema.parse(req.params.id);
  const input = z.object({ text: z.string().min(1) }).parse(req.body);

  await db.transaction(async (tx) => {
    const ticket = await findTicketById(ticketId, tx);
    if (!ticket) throw notFound("Ticket not found");

    const isAdmin = actor.role === "admin" || actor.role === "super_admin";
    if (ticket.createdBy !== actor.id && !isAdmin)
      throw forbidden("Unauthorized");

    await addMessage(ticket.id, actor.id, input.text, tx);
  });
}

/** `POST /api/v1/admin/tickets/:id/escalate` */
export async function escalateTicket(req: Request) {
  const actor = actorOf(req);
  const ticketId = recordIdSchema.parse(req.params.id);

  await db.transaction(async (tx) => {
    const ticket = await findTicketById(ticketId, tx);
    if (!ticket) throw notFound("Ticket not found");

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

/**
 * `GET /api/v1/support/tickets` — admins get the open queue, others their own.
 * Author names are resolved here so the pages do not need a second call.
 */
export async function myTickets(req: Request) {
  const actor = actorOf(req);
  const tickets =
    actor.role === "admin" || actor.role === "super_admin"
      ? await listOpenTickets(actor.role === "admin" ? "admin" : undefined)
      : await listTicketsCreatedBy(actor.id);

  const names = await authorNames([
    ...new Set(
      tickets.flatMap((ticket) => [
        ticket.createdBy,
        ...ticket.messages.map((message) => message.authorId),
      ]),
    ),
  ]);

  return tickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    state: ticket.state,
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt.toISOString(),
    createdBy: { name: names.get(ticket.createdBy) ?? "Unknown" },
    messages: ticket.messages.map((message) => ({
      author: names.get(message.authorId) ?? "Unknown",
      text: message.text,
    })),
  }));
}
