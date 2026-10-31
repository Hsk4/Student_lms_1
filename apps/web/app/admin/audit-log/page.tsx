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
import { PageHeader, Card, Empty, formatDate } from "@/components/ui/nila";
import { api } from "@/lib/api-client";

type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actor?: { name: string; email: string };
  before: unknown;
  after: unknown;
  at: string;
};

export default function AuditLogPage() {
  const auditQuery = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api.get<AuditEntry[]>("/admin/audit-log"),
  });
  const entries = auditQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append only. Newest first, last 200 entries."
      />

      {entries.length === 0 ? (
        <Empty>No entries yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(entry.at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.actor ? (
                      <>
                        <p className="font-medium">{entry.actor.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.actor.email}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.action}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>{entry.targetType}</p>
                    <p className="font-mono text-muted-foreground">
                      {entry.targetId ?? "-"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-[11px] leading-5 text-muted-foreground">
                      {JSON.stringify(
                        { before: entry.before, after: entry.after },
                        null,
                        0,
                      )}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
