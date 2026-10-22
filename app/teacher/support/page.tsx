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
import { connectDB } from "@/lib/db";
import { SupportTicket } from "@/models/support-ticket";
import {
  NewTicketForm,
  TicketReplyForm,
} from "@/components/support/support-forms";

type TicketMessage = { authorId?: { name?: string } | null; text: string };

export default async function TeacherSupportPage() {
  const session = await requireRole(["teacher"]);
  await connectDB();

  const rawTickets = await SupportTicket.find({ createdBy: session.actorId })
    .populate("messages.authorId", "name")
    .sort({ createdAt: -1 })
    .lean();
  const tickets = rawTickets as unknown as {
    _id: unknown;
    subject: string;
    state: string;
    createdAt: Date;
    messages: TicketMessage[];
  }[];

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
            <Card key={String(ticket._id)} className="p-4">
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
                {ticket.messages.map((message: TicketMessage, index: number) => (
                  <p key={index} className="text-sm">
                    <span className="font-medium">
                      {message.authorId?.name ?? "School"}:
                    </span>{" "}
                    {message.text}
                  </p>
                ))}
              </div>
              <TicketReplyForm ticketId={String(ticket._id)} />
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
