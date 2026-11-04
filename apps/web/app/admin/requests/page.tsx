"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PageHeader, Card, RoleChip, formatDate } from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { EmptyState } from "@/components/shared/empty-state";
import { Inbox } from "lucide-react";
import { RequestActions } from "./request-actions";

type RequestRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  note?: string;
  state: string;
  createdAt: string;
  board?: string;
  level?: string;
  subjects: string;
  userStatus: string;
  userRole: string | null;
  requestedRole: string | null;
};



const load = (state: string) => () => api.get<RequestRow[]>("/admin/requests", { state });

export default function AdminRequestsPage() {
  const [openQuery, approvedQuery, rejectedQuery] = useQueries({
    queries: [
      { queryKey: ["admin-requests", "open"], queryFn: load("open") },
      { queryKey: ["admin-requests", "approved"], queryFn: load("approved") },
      { queryKey: ["admin-requests", "rejected"], queryFn: load("rejected") },
    ],
  });

  const open = openQuery.data ?? [];
  const decided = [...(approvedQuery.data ?? []), ...(rejectedQuery.data ?? [])]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 15);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Approving assigns the role and activates the account. Every decision is audited."
      />

      <h2 className="mb-3 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
        <ArchNumber n="1" size={26} tone="cobalt" />
        Open ({open.length})
      </h2>

      {open.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No open requests"
          description="New sign-ups wait here until the office approves them. You are all caught up."
        />
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
                <dt className="text-muted-foreground">Requested</dt>
                <dd>
                  {request.requestedRole ? (
                    <RoleChip role={request.requestedRole} />
                  ) : (
                    <span className="text-muted-foreground">Not stated</span>
                  )}
                </dd>
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
                <RequestActions
                  requestId={request.id}
                  defaultRole={request.requestedRole ?? "student"}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recently decided
      </h2>

      {decided.length === 0 ? (
        <EmptyState
          size="inline"
          icon={Inbox}
          title="Nothing decided yet"
          description="Approved and declined requests are listed here for the record."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decided.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <p className="font-medium">{request.name}</p>
                    <p className="text-xs text-muted-foreground">{request.email}</p>
                  </TableCell>
                  <TableCell className="capitalize">{request.state}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 capitalize">
                      {request.userStatus}
                      <RoleChip role={request.userRole} />
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
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
