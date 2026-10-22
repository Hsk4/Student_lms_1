export const instant = false;

import { listAuditLog } from "@/lib/queries/admin";
import { PageHeader, Card, Empty, formatDate } from "@/components/ui/nila";

export default async function AuditLogPage() {
  const entries = await listAuditLog();

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
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(entry.at)}
                  </td>
                  <td className="text-sm">
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
                  </td>
                  <td className="font-mono text-xs">{entry.action}</td>
                  <td className="text-xs">
                    <p>{entry.targetType}</p>
                    <p className="font-mono text-muted-foreground">
                      {entry.targetId ?? "-"}
                    </p>
                  </td>
                  <td className="max-w-md">
                    <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-[11px] leading-5 text-muted-foreground">
                      {JSON.stringify(
                        { before: entry.before, after: entry.after },
                        null,
                        0,
                      )}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
