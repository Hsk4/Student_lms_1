export const instant = false;

import { listAccessRequests } from "@/lib/queries/admin";
import { PageHeader, Card, Empty, RoleChip, formatDate } from "@/components/ui/nila";
import { RequestActions } from "./request-actions";

export default async function AdminRequestsPage() {
  const open = await listAccessRequests("open");
  const decided = [
    ...(await listAccessRequests("approved")),
    ...(await listAccessRequests("rejected")),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 15);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Approving assigns the role and activates the account. Every decision is audited."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Open ({open.length})
      </h2>

      {open.length === 0 ? (
        <Empty>No open requests.</Empty>
      ) : (
        <div className="space-y-3">
          {open.map((request) => (
            <Card key={request.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{request.name}</p>
                  <p className="text-sm text-muted-foreground">{request.email}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(request.createdAt)}
                </p>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <dt className="text-muted-foreground">Board</dt>
                <dd>{request.board ?? "-"}</dd>
                <dt className="text-muted-foreground">Level</dt>
                <dd>{request.level ?? "-"}</dd>
                <dt className="text-muted-foreground">Subjects</dt>
                <dd>{request.subjects || "-"}</dd>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="flex items-center gap-2">
                  <span className="capitalize">{request.userStatus}</span>
                  <RoleChip role={request.userRole} />
                </dd>
              </dl>

              {request.note ? (
                <p className="mt-3 rounded-[var(--radius-card)] bg-surface px-3 py-2 text-sm text-muted-foreground">
                  {request.note}
                </p>
              ) : null}

              <div className="mt-4">
                <RequestActions requestId={request.id} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recently decided
      </h2>

      {decided.length === 0 ? (
        <Empty>Nothing decided yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>Account</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((request) => (
                <tr key={request.id}>
                  <td>
                    <p className="font-medium">{request.name}</p>
                    <p className="text-xs text-muted-foreground">{request.email}</p>
                  </td>
                  <td className="capitalize">{request.state}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 capitalize">
                      {request.userStatus}
                      <RoleChip role={request.userRole} />
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
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
