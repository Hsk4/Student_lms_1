"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { api } from "@/lib/api-client";

type InvoiceRow = {
  id: string;
  period: string;
  amount: number;
  dueDate: string;
  state: string;
  studentName?: string;
  studentEmail?: string;
};

export default function AdminInvoicesPage() {
  const invoicesQuery = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => api.get<InvoiceRow[]>("/admin/invoices"),
  });
  const invoices = invoicesQuery.data ?? [];

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
                        <p className="font-medium">
                          {invoice.studentName ?? "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.studentEmail ?? ""}
                        </p>
                      </TableCell>
                      <TableCell>{invoice.period}</TableCell>
                      <TableCell className="font-mono">
                        {Number(invoice.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`status-${
                            invoice.state === "paid"
                              ? "green"
                              : invoice.state === "void"
                                ? "amber"
                                : "red"
                          }`}
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
          <p className="mt-2 text-xs text-muted-foreground">
            Form and additional actions coming soon.
          </p>
        </Card>
      </div>
    </div>
  );
}
