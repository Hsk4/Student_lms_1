"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDay,
} from "@/components/ui/nila";
type InvoiceRow = {
  id: string;
  period: string;
  amount: number;
  dueDate: string;
  state: string;
  paidAt: string | null;
};

export default function StudentInvoicesPage() {
  const me = useAuth();
  // Scoped to the caller: the API only answers for the student's own id.
  const invoicesQuery = useQuery({
    queryKey: ["student", "invoices", me.user?.id],
    queryFn: () =>
      api.get<InvoiceRow[]>("/invoices", { studentId: me.user?.id ?? "" }),
    enabled: Boolean(me.user?.id),
  });
  const invoices = invoicesQuery.data ?? [];

  const unpaid = invoices.filter((invoice) => invoice.state === "unpaid");
  const paid = invoices.filter((invoice) => invoice.state === "paid");
  const due = unpaid.reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Tuition invoices and the payments the office recorded."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Outstanding"
          value={`PKR ${due.toLocaleString("en-PK")}`}
        />
        <Stat label="Unpaid invoices" value={unpaid.length} />
        <Stat label="Paid invoices" value={paid.length} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Outstanding
      </h2>
      {unpaid.length === 0 ? (
        <Empty>Nothing outstanding.</Empty>
      ) : (
        <div className="space-y-2">
          {unpaid.map((invoice) => (
            <Card
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div>
                <p className="font-medium">{invoice.period}</p>
                <p className="text-xs text-muted-foreground">
                  Due {formatDay(invoice.dueDate)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">
                  PKR {invoice.amount.toLocaleString("en-PK")}
                </span>
                <Chip tone="amber">Unpaid</Chip>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Payment history
      </h2>
      {paid.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="space-y-2">
          {paid.map((invoice) => (
            <Card
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div>
                <p className="font-medium">{invoice.period}</p>
                <p className="text-xs text-muted-foreground">
                  Paid {formatDay(invoice.paidAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">
                  PKR {invoice.amount.toLocaleString("en-PK")}
                </span>
                <Chip tone="green">Paid</Chip>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
