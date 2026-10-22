export const instant = false;

import { connectDB } from '@/lib/db';
import { ParentInvite } from '@/models/parent-invite';
import { User } from '@/models/user';
import { requireRequestTime } from '@/lib/auth/panels';
import { PageHeader, Card, Empty, formatDay } from '@/components/ui/nila';
import { InviteActions } from './invite-actions';
import { LinkGuardianForm } from './link-form';

export default async function AdminParentInvitesPage() {
  await requireRequestTime();
  await connectDB();

  const invites = await ParentInvite.find()
    .populate('studentId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const [parents, students] = await Promise.all([
    User.find({ role: 'parent', status: 'active' }).select('name email').sort({ name: 1 }).lean(),
    User.find({ role: 'student', status: 'active' }).select('name email').sort({ name: 1 }).lean(),
  ]);

  const invitesWithStudent = invites.map((invite) => {
    const student = invite.studentId as unknown as {
      name?: string;
      email?: string;
    } | null;
    return {
      id: String(invite._id),
      studentName: student?.name ?? 'Unknown',
      studentEmail: student?.email ?? '',
      parentName: invite.parentName,
      parentEmail: invite.parentEmail,
      code: invite.code,
      state: invite.state,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt,
    };
  });

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
              id: String(parent._id),
              label: `${parent.name} (${parent.email})`,
            }))}
            students={students.map((student) => ({
              id: String(student._id),
              label: `${student.name} (${student.email})`,
            }))}
          />
        </div>
      </Card>

      {invitesWithStudent.length === 0 ? (
        <Empty>No link codes yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Parent</th>
                <th>Student</th>
                <th>Code</th>
                <th>Status</th>
                <th>Created</th>
                <th>Accepted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitesWithStudent.map((invite) => (
                <tr key={invite.id}>
                  <td>
                    <p className="font-medium">{invite.parentName}</p>
                    <p className="text-xs text-muted-foreground">{invite.parentEmail}</p>
                  </td>
                  <td>
                    <p className="font-medium">{invite.studentName}</p>
                    <p className="text-xs text-muted-foreground">{invite.studentEmail}</p>
                  </td>
                  <td className="font-mono text-xs tracking-wider">{invite.code}</td>
                  <td>
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
                  </td>
                  <td className="text-xs text-muted-foreground">{formatDay(invite.createdAt)}</td>
                  <td className="text-xs text-muted-foreground">
                    {invite.acceptedAt ? formatDay(invite.acceptedAt) : '-'}
                  </td>
                  <td className="text-end">
                    {invite.state === 'sent' && (
                      <InviteActions inviteId={invite.id} />
                    )}                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
