export const instant = false;

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { requireRequestTime } from '@/lib/auth/panels';
import { PageHeader, Card, Empty, formatDay } from '@/components/ui/nila';
import { listParentInvites } from '@/lib/queries/admin';
import { listUsersByRole } from '@/lib/queries/users';
import { InviteActions } from './invite-actions';
import { LinkGuardianForm } from './link-form';

export default async function AdminParentInvitesPage() {
  await requireRequestTime();
  // One read for the invites (student joined in SQL), one per active account
  // list the repair form offers.
  const [invitesWithStudent, parentRows, studentRows] = await Promise.all([
    listParentInvites(),
    listUsersByRole('parent', { status: 'active' }),
    listUsersByRole('student', { status: 'active' }),
  ]);

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name);
  const parents = [...parentRows].sort(byName);
  const students = [...studentRows].sort(byName);

  return (
    <>
      <PageHeader
        title="Guardian link codes"
        description="Codes issued by students, and the parent accounts linked through them."
      />

      <Card className="mb-6 p-5">
        <h2 className="text-sm font-semibold">Repair a guardian link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Use this when a parent accepted an invitation but the student does not appear in
          their panel. The link is written on both sides and audit-logged.
        </p>
        <div className="max-w-md">
          <LinkGuardianForm
            parents={parents.map((parent) => ({
              id: parent.id,
              label: `${parent.name} (${parent.email})`,
            }))}
            students={students.map((student) => ({
              id: student.id,
              label: `${student.name} (${student.email})`,
            }))}
          />
        </div>
      </Card>

      {invitesWithStudent.length === 0 ? (
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
              {invitesWithStudent.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <p className="font-medium">{invite.parentName}</p>
                    <p className="text-xs text-muted-foreground">{invite.parentEmail}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{invite.studentName}</p>
                    <p className="text-xs text-muted-foreground">{invite.studentEmail}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs tracking-wider">{invite.code}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        invite.state === 'sent'
                          ? 'bg-status-amber-soft text-status-amber'
                          : invite.state === 'accepted'
                            ? 'bg-status-green-soft text-status-green'
                            : invite.state === 'revoked'
                              ? 'bg-border text-muted-foreground'
                              : 'bg-status-red-soft text-status-red'
                      }`}
                    >
                      {invite.state}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDay(invite.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {invite.acceptedAt ? formatDay(invite.acceptedAt) : '-'}
                  </TableCell>
                  <TableCell className="text-end">
                    {invite.state === 'sent' && (
                      <InviteActions inviteId={invite.id} />
                    )}                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
