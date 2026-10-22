export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDay,
} from "@/components/ui/nila";
import { listChildOverviews } from "@/actions/parent-panel";
import { getStudentInvoices } from "@/actions/tuition-support";
import { ChildSwitcher } from "@/components/shell/shell";

export default async function ParentInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: selected } = await searchParams;
  const children = await listChildOverviews();
  const visible = selected
    ? children.filter((item) => item.id === selected)
    : children;

  const perChild = await Promise.all(
    visible.map(async (child) => ({
      child,
      // Row guard inside the action: a parent may only read a linked child.
      invoices: await getStudentInvoices(child.id),
    })),
  );

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
                  href={`/parent/children/${child.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Child overview
                </Link>
              </div>

              {invoices.length === 0 ? (
                <Empty>No invoice issued yet.</Empty>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Amount</th>
                        <th>Due</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...unpaid, ...paid].map((invoice) => (
                        <tr key={String(invoice._id)}>
                          <td className="font-medium">{invoice.period}</td>
                          <td className="tabular-nums">
                            PKR {invoice.amount.toLocaleString("en-PK")}
                          </td>
                          <td className="text-muted-foreground">
                            {formatDay(invoice.dueDate)}
                          </td>
                          <td>
                            <Chip
                              tone={
                                invoice.state === "paid" ? "green" : "amber"
                              }
                            >
                              {invoice.state}
                            </Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
