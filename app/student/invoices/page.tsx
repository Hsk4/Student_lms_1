export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn, getCurrentUser } from '@/lib/auth/roles';
import { getStudentInvoices } from '@/actions/tuition-support';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');

  const invoices = await getStudentInvoices(user.id);

  const unpaid = invoices.filter((inv: any) => inv.state === 'unpaid');
  const paid = invoices.filter((inv: any) => inv.state === 'paid');

  return (
    <div>
      <PageHeader
        title="My invoices"
        description="Tuition fees and payments."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Outstanding ({unpaid.length})
      </h2>
      {unpaid.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {unpaid.map((inv: any) => (
            <Card key={String(inv._id)} className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {inv.period} • PKR {inv.amount.toLocaleString()}
                </span>
                <span className="status-red">Due {new Date(inv.dueDate).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Payment history ({paid.length})
      </h2>
      {paid.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <div className="space-y-2">
          {paid.map((inv: any) => (
            <Card key={String(inv._id)} className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {inv.period} • PKR {inv.amount.toLocaleString()}
                </span>
                <span className="status-green">Paid {new Date(inv.paidAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
