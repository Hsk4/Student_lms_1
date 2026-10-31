export const instant = false;

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { requireRequestTime } from '@/lib/auth/panels';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invoices as invoiceRows, users } from '@/db/schema';

async function Body() {
  await requireRequestTime();
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  // `markedBy` is optional, so its name needs a LEFT JOIN; `studentId` is
  // required, so `students` is an inner join on the same users table.
  const invoices = await db
    .select({
      id: invoiceRows.id,
      period: invoiceRows.period,
      // numeric comes back as a string to keep the cents exact.
      amount: invoiceRows.amount,
      dueDate: invoiceRows.dueDate,
      state: invoiceRows.state,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(invoiceRows)
    .innerJoin(users, eq(users.id, invoiceRows.studentId))
    .orderBy(desc(invoiceRows.createdAt));

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount (PKR)</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <p className="font-medium">{invoice.studentName}</p>
                        <p className="text-xs text-muted-foreground">{invoice.studentEmail}</p>
                      </TableCell>
                      <TableCell>{invoice.period}</TableCell>
                      <TableCell className="font-mono">{Number(invoice.amount).toLocaleString()}</TableCell>
                      <TableCell>{invoice.dueDate.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span
                          className={`status-${invoice.state === 'paid' ? 'green' : invoice.state === 'void' ? 'amber' : 'red'}`}
                        >
                          {invoice.state}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
