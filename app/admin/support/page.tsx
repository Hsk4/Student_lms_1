export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { getAdminTickets } from '@/actions/tuition-support';

async function Body() {
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  const tickets = await getAdminTickets();

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Student and teacher support requests. Escalate to super admin if needed."
      />

      {tickets.length === 0 ? (
        <Empty>No open tickets.</Empty>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket: any) => (
            <Card key={String(ticket._id)} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{ticket.subject}</h3>
                  <p className="text-sm text-muted-foreground">
                    By {ticket.createdBy?.name} • {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`status-${
                    ticket.state === 'escalated'
                      ? 'red'
                      : ticket.state === 'open'
                        ? 'amber'
                        : 'green'
                  }`}
                >
                  {ticket.state}
                </span>
              </div>

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {ticket.messages.map((msg: any, idx: number) => (
                  <p key={idx} className="text-sm">
                    <span className="font-medium">{msg.authorId?.name || 'Unknown'}:</span> {msg.text}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
