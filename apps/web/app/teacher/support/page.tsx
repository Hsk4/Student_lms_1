export const instant = false;

import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
import { requireRole } from "@/lib/auth/guards";
import {
  NewTicketForm,
  TicketReplyForm,
} from "@/components/support/support-forms";
import {
  authorNames,
  listTicketsCreatedBy,
} from "@/lib/queries/support-tickets";

export default async function TeacherSupportPage() {
  const session = await requireRole(["teacher"]);

  const rawTickets = await listTicketsCreatedBy(session.actorId);
  const names = await authorNames([
    ...new Set(
      rawTickets.flatMap((ticket) =>
        ticket.messages.map((message) => message.authorId),
      ),
    ),
  ]);
  const tickets = rawTickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    state: ticket.state,
    createdAt: ticket.createdAt,
    messages: ticket.messages.map((message) => ({
      author:
        message.authorId === session.actorId
          ? "You"
          : names.get(message.authorId) ?? "School",
      text: message.text,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Support"
        description="Contact the school office about courses, students or schedules."
      />

      {tickets.length === 0 ? (
        <Empty>No tickets yet.</Empty>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{ticket.subject}</h2>
                  <p className="text-xs text-muted-foreground">
                    Opened {formatDay(ticket.createdAt)}
                  </p>
                </div>
                <Chip tone={toneFor(ticket.state)}>{ticket.state}</Chip>
              </div>
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {ticket.messages.map((message, index) => (
                  <p key={index} className="text-sm">
                    <span className="font-medium">{message.author}:</span>{" "}
                    {message.text}
                  </p>
                ))}
              </div>
              <TicketReplyForm ticketId={ticket.id} />
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 h-fit p-5">
        <h2 className="text-sm font-semibold">Open a ticket</h2>
        <div className="mt-3">
          <NewTicketForm />
        </div>
      </Card>
    </div>
  );
}
