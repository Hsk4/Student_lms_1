"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useCallback, useState } from "react";
import type { AdminRequestView } from "@lms/shared";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { PageHeader, Card, RoleChip, formatDate } from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { EmptyState } from "@/components/shared/empty-state";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { RequestActions } from "./request-actions";
import { RequestDetail } from "./request-detail";

/*
 * The request type, shown as a chip in the list so the office can tell a
 * teacher application from a parent one without opening either. `RoleChip`
 * already styles teacher and parent; a request with no role is legacy.
 */
function TypeChip({ role }: { role: AdminRequestView["requestedRole"] }) {
  if (!role) {
    return (
      <span className="chip border-border text-muted-foreground">Legacy</span>
    );
  }
  return <RoleChip role={role} />;
}

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "none", label: "Legacy" },
] as const;

const load = (state: string, role: string) => () =>
  api.get<AdminRequestView[]>("/admin/requests", {
    state,
    ...(role ? { role } : {}),
  });

/** One open request: the summary line, the actions, and the full application. */
function OpenRequest({
  request,
  expanded,
  onToggle,
  onDecided,
}: {
  request: AdminRequestView;
  expanded: boolean;
  onToggle: () => void;
  onDecided: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
            {request.name}
            <TypeChip role={request.requestedRole} />
          </p>
          <p className="text-sm text-muted-foreground">{request.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {formatDate(request.createdAt)}
          </p>
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-secondary h-8 px-3 text-xs"
            aria-expanded={expanded}
            aria-controls={`request-detail-${request.id}`}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
            {expanded ? "Hide details" : "View details"}
          </button>
        </div>
      </div>

      {/* Summary: enough to triage, not enough to judge. */}
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Type",
            value: <TypeChip role={request.requestedRole} />,
          },
          {
            label: "Status",
            value: <span className="capitalize">{request.state}</span>,
          },
          {
            label: request.application.parent ? "Student" : "Subjects",
            value: request.application.parent
              ? request.application.parent.studentName
              : request.subjectLabels.join(", ") || "-",
          },
          {
            label: "Account",
            value: (
              <span className="flex items-center gap-2">
                <span className="capitalize">{request.userStatus}</span>
                <RoleChip role={request.userRole} />
              </span>
            ),
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0">{item.value}</dd>
          </div>
        ))}
      </dl>

      {request.note && !expanded ? (
        <p className="mt-3 line-clamp-2 rounded-[var(--radius-card)] bg-surface px-3 py-2 text-sm text-muted-foreground">
          {request.note}
        </p>
      ) : null}

      <div className="mt-4">
        <RequestActions
          requestId={request.id}
          defaultRole={
            request.requestedRole === "teacher" ||
            request.requestedRole === "parent"
              ? request.requestedRole
              : "student"
          }
          requestedSubjectIds={request.subjectIds ?? []}
          onDecided={onDecided}
        />
      </div>

      {expanded ? (
        <div id={`request-detail-${request.id}`}>
          <RequestDetail request={request} />
        </div>
      ) : null}
    </Card>
  );
}

export default function AdminRequestsPage() {
  // All three lists refresh together after a decision.
  const [reloadTick, setReloadTick] = useState(0);
  const onDecided = useCallback(() => setReloadTick((t) => t + 1), []);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openQuery = useAsync(load("open", typeFilter), [
    reloadTick,
    typeFilter,
  ]);
  const approvedQuery = useAsync(load("approved", typeFilter), [
    reloadTick,
    typeFilter,
  ]);
  const rejectedQuery = useAsync(load("rejected", typeFilter), [
    reloadTick,
    typeFilter,
  ]);

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

      {/* Type filter: Teacher vs Parent vs legacy, without opening every row. */}
      <div
        className="mb-4 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter requests by type"
      >
        {TYPE_FILTERS.map((option) => {
          const active = typeFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTypeFilter(option.value)}
              className={`chip h-8 px-3 transition-colors duration-150 ${
                active
                  ? "border-primary bg-tint text-tint-foreground"
                  : "border-border text-muted-foreground hover:text-primary"
              }`}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <h2 className="mb-3 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
        <ArchNumber n="1" size={26} tone="cobalt" />
        Open ({open.length})
      </h2>

      {open.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No open requests"
          description={
            typeFilter
              ? "No open requests of this type. Try another filter."
              : "New sign-ups wait here until the office approves them. You are all caught up."
          }
        />
      ) : (
        <div className="space-y-3">
          {open.map((request) => (
            <OpenRequest
              key={request.id}
              request={request}
              expanded={expandedId === request.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === request.id ? null : request.id,
                )
              }
              onDecided={onDecided}
            />
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
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decided.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <p className="font-medium">{request.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <TypeChip role={request.requestedRole} />
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
