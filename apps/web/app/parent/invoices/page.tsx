"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDay,
} from "@/components/ui/nila";
import { ChildSwitcher } from "@/components/shell/shell";
import { InlineLoading } from "@/components/shared/skeleton";

type ChildOverview = { id: string; name: string; dueAmount: number };
type InvoiceRow = { id: string; period: string; amount: number; dueDate: string; state: string };

function ParentInvoicesContent() {
  const params = useSearchParams();
  const selected = params.get("child") ?? undefined;

  const childrenQuery = useAsync(
    () => api.get<ChildOverview[]>("/parent/overview"),
    [],
  );
  const children = childrenQuery.data ?? [];
  const visible = selected ? children.filter((item) => item.id === selected) : children;

  // The API only answers for a child linked to this parent.
  const invoiceQueries = useQueries({
    queries: visible.map((child) => ({
      queryKey: ["parent", "invoices", child.id],
      queryFn: () => api.get<InvoiceRow[]>("/invoices", { studentId: child.id }),
    })),
  });
  const perChild = visible.map((child, index) => ({
    child,
    invoices: invoiceQueries[index]?.data ?? [],
  }));

  const totalDue = visible.reduce((sum, child) => sum + child.dueAmount, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Tuition invoices for your children. Payments are recorded by the school office."
      />

      <ChildSwitcher
        basePath="/parent/invoices"
        activeId={selected}
        childRows={children.map(({ id, name }) => ({ id, name }))}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Outstanding"
          value={`PKR ${totalDue.toLocaleString("en-PK")}`}
        />
        <Stat label="Children shown" value={visible.length} />
        <Stat
          label="Unpaid invoices"
          value={perChild.reduce(
            (sum, item) =>
              sum +
              item.invoices.filter((invoice) => invoice.state === "unpaid")
                .length,
            0,
          )}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <Empty>No linked children.</Empty>
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {perChild.map(({ child, invoices }) => {
          const unpaid = invoices.filter(
            (invoice) => invoice.state === "unpaid",
          );
          const paid = invoices.filter((invoice) => invoice.state === "paid");

          return (
            <section key={child.id}>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {child.name}
                </h2>
                <Link
                  href={`/parent/children/detail?id=${child.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Child overview
                </Link>
              </div>

              {invoices.length === 0 ? (
                <Empty>No invoice issued yet.</Empty>
              ) : (
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...unpaid, ...paid].map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.period}</TableCell>
                          <TableCell className="tabular-nums">
                            PKR {invoice.amount.toLocaleString("en-PK")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDay(invoice.dueDate)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              tone={
                                invoice.state === "paid" ? "green" : "amber"
                              }
                            >
                              {invoice.state}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ParentInvoicesPage() {
  return (
    <Suspense fallback={<InlineLoading />}>
      <ParentInvoicesContent />
    </Suspense>
  );
}