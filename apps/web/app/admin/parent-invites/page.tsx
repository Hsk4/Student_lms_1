"use client";

import { useAsync } from "@/lib/use-async";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PageHeader, Card, Empty, formatDay } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { InviteActions } from "./invite-actions";
import { LinkGuardianForm } from "./link-form";

type InviteRow = {
  id: string;
  parentName: string;
  parentEmail: string;
  studentName: string;
  studentEmail: string;
  code: string;
  state: string;
  createdAt: string;
  acceptedAt: string | null;
};

type Options = {
  parents: { id: string; label: string }[];
  students: { id: string; label: string }[];
};

export default function AdminParentInvitesPage() {
  const invitesQuery = useAsync(
    () => api.get<InviteRow[]>("/admin/parent-links"),
    [],
  );
  const optionsQuery = useAsync(
    () => api.get<Options>("/admin/parent-links/options"),
    [],
  );

  const invites = invitesQuery.data ?? [];
  const options = optionsQuery.data ?? { parents: [], students: [] };

  return (
    <>
      <PageHeader
        title="Guardian link codes"
        description="Codes issued by students, and the parent accounts linked through them."
      />

      <Card className="mb-6 p-5">
        <h2 className="text-sm font-semibold">Repair a guardian link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Use this when a parent accepted an invitation but the student does not
          appear in their panel. The link is written on both sides and
          audit-logged.
        </p>
        <div className="max-w-md">
          <LinkGuardianForm
            parents={options.parents}
            students={options.students}
            onDone={invitesQuery.reload}
          />
        </div>
      </Card>

      {invites.length === 0 ? (
        <Empty>No link codes yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <p className="font-medium">{invite.parentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {invite.parentEmail}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{invite.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {invite.studentEmail}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs tracking-wider">
                    {invite.code}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        invite.state === "sent"
                          ? "bg-status-amber-soft text-status-amber"
                          : invite.state === "accepted"
                            ? "bg-status-green-soft text-status-green"
                            : invite.state === "revoked"
                              ? "bg-border text-muted-foreground"
                              : "bg-status-red-soft text-status-red"
                      }`}
                    >
                      {invite.state}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDay(invite.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {invite.acceptedAt ? formatDay(invite.acceptedAt) : "-"}
                  </TableCell>
                  <TableCell className="text-end">
                    {invite.state === "sent" && (
                      <InviteActions
                    inviteId={invite.id}
                    onDone={invitesQuery.reload}
                  />
                    )}
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
