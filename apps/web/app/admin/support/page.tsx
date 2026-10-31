export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  PageHeader,
  Card,
  Chip,
  Empty,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
import {
  authorNames,
  listOpenTickets,
} from "@/lib/queries/support-tickets";
import { checkAccess } from "@/lib/auth/roles";
import {
  EscalateTicketButton,
  TicketReplyForm,
} from "@/components/support/support-forms";

async function Body() {
  const { redirectTo, user } = await checkAccess(["admin", "super_admin"]);
  if (redirectTo) redirect(redirectTo);

  // A plain admin sees only their own queue; a super_admin sees everything.
  const rawTickets = await listOpenTickets(
    user.role === "admin" ? "admin" : undefined,
  );

  // Messages are rows now, so author names are one extra read, not a `populate`.
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
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt,
    createdBy: { name: names.get(ticket.createdBy) ?? "Unknown" },
    messages: ticket.messages.map((message) => ({
      author: names.get(message.authorId) ?? "Unknown",
      text: message.text,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Student and teacher support requests. Escalate to the super admin if needed."
      />

      {tickets.length === 0 ? (
        <Empty>No open tickets.</Empty>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{ticket.subject}</h2>
                  <p className="text-sm text-muted-foreground">
                    By {ticket.createdBy?.name ?? "Unknown"} /{" "}
                    {formatDay(ticket.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone={toneFor(ticket.state)}>{ticket.state}</Chip>
                  {ticket.state !== "escalated" ? (
                    <EscalateTicketButton ticketId={ticket.id} />
                  ) : (
                    <Chip tone="red">super admin</Chip>
                  )}
                </div>
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
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Body />
    </Suspense>
  );
}
