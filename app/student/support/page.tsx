export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { getMyTickets } from '@/actions/tuition-support';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');

  const tickets = await getMyTickets();

  return (
    <div>
      <PageHeader
        title="Support"
        description="Contact the school office with questions or concerns."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {tickets.length === 0 ? (
            <Empty>No support tickets yet.</Empty>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket: any) => (
                <Card key={String(ticket._id)} className="p-4">
                  <h3 className="font-semibold">{ticket.subject}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>

                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {ticket.messages.map((msg: any, idx: number) => (
                      <p key={idx} className="text-sm">
                        <span className="font-medium">{msg.authorId?.name || 'Unknown'}:</span>{' '}
                        {msg.text}
                      </p>
                    ))}
                  </div>

                  <span className={`status-${ticket.state === 'resolved' ? 'green' : 'amber'} mt-3 inline-block`}>
                    {ticket.state}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit p-5">
          <h3 className="text-sm font-semibold">Create ticket</h3>
          <p className="mt-2 text-xs text-muted-foreground">Form coming soon.</p>
        </Card>
      </div>
    </div>
  );
}

export default function StudentSupportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
