'use server';

import { createClerkClient } from '@clerk/backend';
import { connectDB } from '@/lib/db';
import { ParentInvite } from '@/models/parent-invite';
import { requireRole } from '@/lib/auth/guards';
import { toState, type ActionState } from '@/lib/actions';

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('Missing CLERK_SECRET_KEY');
const clerk = createClerkClient({ secretKey });

/**
 * Revoke a parent invite (expires the Clerk invitation link).
 */
export async function revokeParentInvite(inviteId: string): Promise<ActionState> {
  try {
    await requireRole(['super_admin', 'admin']);
    await connectDB();

    const invite = await ParentInvite.findById(inviteId);
    if (!invite) throw new Error('Invite not found');
    if (invite.state === 'revoked') throw new Error('Invite already revoked');
    if (invite.state === 'accepted') throw new Error('Cannot revoke accepted invite');

    // Revoke in Clerk
    await clerk.invitations.revokeInvitation(invite.clerkInvitationId);
    console.log(`[Admin] Revoked Clerk invitation ${invite.clerkInvitationId}`);

    // Update in MongoDB
    invite.state = 'revoked';
    await invite.save();

    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Resend a parent invite (creates a new Clerk invitation link).
 */
export async function resendParentInvite(inviteId: string): Promise<ActionState<{ invitationUrl?: string }>> {
  try {
    await requireRole(['super_admin', 'admin']);
    await connectDB();

    const invite = await ParentInvite.findById(inviteId);
    if (!invite) throw new Error('Invite not found');
    if (invite.state === 'accepted') throw new Error('Cannot resend accepted invite');

    // Revoke old invitation if still pending
    if (invite.state === 'sent') {
      try {
        await clerk.invitations.revokeInvitation(invite.clerkInvitationId);
      } catch (error) {
        console.warn(`[Admin] Failed to revoke old invitation ${invite.clerkInvitationId}`, error);
      }
    }

    // Create new invitation
    const newInvitation = await clerk.invitations.createInvitation({
      emailAddress: invite.parentEmail,
      expiresInDays: 7,
      ignoreExisting: false,
      publicMetadata: {
        role: 'parent',
        status: 'active',
        onboarded: true,
        studentId: String(invite.studentId),
        parentName: invite.parentName,
      },
    });

    console.log(`[Admin] Resent invitation for ${invite.parentEmail}: ${newInvitation.id}`);

    // Update in MongoDB
    invite.clerkInvitationId = newInvitation.id;
    invite.state = 'sent';
    await invite.save();

    return { ok: true, data: { invitationUrl: newInvitation.invitation_url } };
  } catch (error) {
    return toState(error);
  }
}
