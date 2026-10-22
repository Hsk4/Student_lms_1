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
import { checkAccess } from "@/lib/auth/roles";
import { getAdminTickets } from "@/actions/tuition-support";
import {
  EscalateTicketButton,
  TicketReplyForm,
} from "@/components/support/support-forms";

type TicketMessage = { authorId?: { name?: string } | null; text: string };

async function Body() {
  const { redirectTo } = await checkAccess(["admin", "super_admin"]);
  if (redirectTo) redirect(redirectTo);

  const rawTickets = await getAdminTickets();
  const tickets = rawTickets as unknown as {
    _id: unknown;
    subject: string;
    state: string;
    assignedTo?: string;
    createdAt: Date;
    createdBy?: { name?: string; email?: string } | null;
    messages: TicketMessage[];
  }[];

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
            <Card key={String(ticket._id)} className="p-4">
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
                    <EscalateTicketButton ticketId={String(ticket._id)} />
                  ) : (
                    <Chip tone="red">super admin</Chip>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {ticket.messages.map((message, index) => (
                  <p key={index} className="text-sm">
                    <span className="font-medium">
                      {message.authorId?.name ?? "Unknown"}:
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
