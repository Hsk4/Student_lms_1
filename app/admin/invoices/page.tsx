export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { requireRequestTime } from '@/lib/auth/panels';
import { Invoice } from '@/models/invoice';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  await requireRequestTime();
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  await connectDB();

  const invoices = await Invoice.find({})
    .populate('studentId', 'name email')
    .populate('markedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create invoices for tuition and mark them paid."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {invoices.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Period</th>
                    <th>Amount (PKR)</th>
                    <th>Due</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: { _id: unknown; studentId?: { name?: string; email?: string } | null; period: string; amount: number; dueDate: string; state: string }) => (
                    <tr key={String(invoice._id)}>
                      <td>
                        <p className="font-medium">{invoice.studentId?.name}</p>
                        <p className="text-xs text-muted-foreground">{invoice.studentId?.email}</p>
                      </td>
                      <td>{invoice.period}</td>
                      <td className="font-mono">{invoice.amount.toLocaleString()}</td>
                      <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                      <td>
                        <span
                          className={`status-${invoice.state === 'paid' ? 'green' : invoice.state === 'void' ? 'amber' : 'red'}`}
                        >
                          {invoice.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h3 className="text-sm font-semibold">Create invoice</h3>
          <p className="mt-2 text-xs text-muted-foreground">Form and additional actions coming soon.</p>
        </Card>
      </div>
    </div>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
