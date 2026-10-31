import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { supportTickets, ticketMessages, users } from "@/db/schema";
import type {
  Id,
  SupportTicket,
  SupportTicketState,
  TicketMessage,
} from "@/lib/types";

/**
 * Support tickets. Postgres-backed.
 *
 * `messages` was an embedded array; it is `ticket_messages` now, so a ticket and
 * its thread are assembled from two reads. The ticket list shows the thread, so
 * the messages for every ticket on the page are fetched in one `IN` query.
 */

type TicketRow = typeof supportTickets.$inferSelect;
type MessageRow = typeof ticketMessages.$inferSelect;

function toMessage(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId,
    text: row.text,
    createdAt: row.createdAt,
  };
}

function toTicket(row: TicketRow, messages: TicketMessage[]): SupportTicket {
  return {
    id: row.id,
    createdBy: row.createdBy,
    subject: row.subject,
    messages,
    state: row.state,
    assignedTo: row.assignedTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function messagesFor(
  ticketIds: Id[],
  conn: Tx | typeof db,
): Promise<Map<Id, TicketMessage[]>> {
  const map = new Map<Id, TicketMessage[]>();
  if (ticketIds.length === 0) return map;

  const rows = await conn
    .select()
    .from(ticketMessages)
    .where(inArray(ticketMessages.ticketId, ticketIds))
    .orderBy(asc(ticketMessages.createdAt));

  for (const row of rows) {
    const current = map.get(row.ticketId);
    if (current) current.push(toMessage(row));
    else map.set(row.ticketId, [toMessage(row)]);
  }
  return map;
}



export async function findTicketById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<SupportTicket | null> {
  const [row] = await conn
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!row) return null;
  const messages = await messagesFor([row.id], conn);
  return toTicket(row, messages.get(row.id) ?? []);
}

/** Unresolved tickets, optionally only those still assigned to `admin`. */
export async function listOpenTickets(
  assignedTo?: "admin" | "super_admin",
  conn: Tx | typeof db = db,
): Promise<SupportTicket[]> {
  const where = [
    ne(supportTickets.state, "resolved"),
    assignedTo ? eq(supportTickets.assignedTo, assignedTo) : undefined,
  ].filter(
    (clause): clause is NonNullable<typeof clause> => clause !== undefined,
  );

  const rows = await conn
    .select()
    .from(supportTickets)
    .where(and(...where))
    .orderBy(desc(supportTickets.createdAt));
  const messages = await messagesFor(
    rows.map((row) => row.id),
    conn,
  );
  return rows.map((row) => toTicket(row, messages.get(row.id) ?? []));
}

export async function listTicketsCreatedBy(
  createdBy: Id,
  conn: Tx | typeof db = db,
): Promise<SupportTicket[]> {
  const rows = await conn
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.createdBy, createdBy))
    .orderBy(desc(supportTickets.createdAt));
  const messages = await messagesFor(
    rows.map((row) => row.id),
    conn,
  );
  return rows.map((row) => toTicket(row, messages.get(row.id) ?? []));
}

export async function createTicket(
  input: {
    createdBy: Id;
    subject: string;
    text: string;
    assignedTo?: "admin" | "super_admin";
  },
  conn: Tx | typeof db = db,
): Promise<SupportTicket> {
  const [ticket] = await conn
    .insert(supportTickets)
    .values({
      createdBy: input.createdBy,
      subject: input.subject,
      state: "open",
      assignedTo: input.assignedTo ?? "admin",
    })
    .returning();

  const [message] = await conn
    .insert(ticketMessages)
    .values({
      ticketId: ticket.id,
      authorId: input.createdBy,
      text: input.text,
    })
    .returning();

  return toTicket(ticket, [toMessage(message)]);
}

export async function addMessage(
  ticketId: Id,
  authorId: Id,
  text: string,
  conn: Tx | typeof db = db,
): Promise<TicketMessage> {
  const [row] = await conn
    .insert(ticketMessages)
    .values({ ticketId, authorId, text })
    .returning();
  return toMessage(row);
}

export async function setTicketState(
  id: Id,
  input: {
    state?: SupportTicketState;
    assignedTo?: "admin" | "super_admin";
  },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(supportTickets).set(input).where(eq(supportTickets.id, id));
}

/**
 * Author names for a ticket thread, so a page can render "who said what" without
 * a `populate()` per message.
 */
export async function authorNames(
  authorIds: Id[],
  conn: Tx | typeof db = db,
): Promise<Map<Id, string>> {
  if (authorIds.length === 0) return new Map();
  const rows = await conn
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, authorIds));
  return new Map(rows.map((row) => [row.id, row.name]));
}
