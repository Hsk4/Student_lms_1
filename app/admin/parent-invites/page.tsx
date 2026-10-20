export const instant = false;

import { connectDB } from '@/lib/db';
import { ParentInvite } from '@/models/parent-invite';
import { User } from '@/models/user';
import { PageHeader, Card, Empty, formatDay } from '@/components/ui/nila';
import { InviteActions } from './invite-actions';

export default async function AdminParentInvitesPage() {
  await connectDB();

  const invites = await ParentInvite.find()
    .populate('studentId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const invitesWithStudent = await Promise.all(
    invites.map(async (invite: any) => ({
      id: String(invite._id),
      studentName: invite.studentId?.name || 'Unknown',
      studentEmail: invite.studentId?.email || '',
      parentName: invite.parentName,
      parentEmail: invite.parentEmail,
      state: invite.state,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt,
      clerkInvitationId: invite.clerkInvitationId,
    }))
  );

  return (
    <>
      <PageHeader
        title="Parent invitations"
        description="View and manage parent invite links."
      />

      {invitesWithStudent.length === 0 ? (
        <Empty>No invitations yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Parent</th>
                <th>Student</th>
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
                      <InviteActions inviteId={invite.id} parentEmail={invite.parentEmail} />
                    )}
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
