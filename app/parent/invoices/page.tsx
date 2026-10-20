export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn, getCurrentUser } from '@/lib/auth/roles';
import { getStudentInvoices } from '@/actions/tuition-support';
import { User } from '@/models/user';
import { connectDB } from '@/lib/db';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'parent' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const parent = await User.findOne({ clerkId: user.clerkId }).lean();
  const children = await User.find({
    'student.guardianIds': parent?._id,
  }).lean();

  const perChild = await Promise.all(
    children.map(async (child) => {
      const invoices = await getStudentInvoices(String(child._id));
      const unpaid = invoices.filter((inv: any) => inv.state === 'unpaid');
      const totalDue = unpaid.reduce((sum: number, inv: any) => sum + inv.amount, 0);

      return {
        id: String(child._id),
        name: child.name,
        invoices,
        totalDue,
      };
    })
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View tuition fees for your children."
      />

      {perChild.length === 0 ? (
        <Empty>No linked children.</Empty>
      ) : (
        <div className="space-y-6">
          {perChild.map((child) => (
            <div key={child.id}>
              <h2 className="mb-3 text-sm font-semibold">{child.name}</h2>

              {child.totalDue > 0 && (
                <Card className="mb-3 p-3 bg-status-red-soft">
                  <p className="text-sm font-medium text-status-red">
                    Outstanding: PKR {child.totalDue.toLocaleString()}
                  </p>
                </Card>
              )}

              <div className="space-y-2">
                {child.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices.</p>
                ) : (
                  child.invoices.map((inv: any) => (
                    <Card
                      key={String(inv._id)}
                      className={`p-3 ${inv.state === 'unpaid' ? 'border-status-red' : ''}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {inv.period} • PKR {inv.amount.toLocaleString()}
                        </span>
                        <span className={`status-${inv.state === 'paid' ? 'green' : 'red'}`}>
                          {inv.state}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
