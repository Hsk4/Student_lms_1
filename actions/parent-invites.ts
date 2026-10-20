'use server';

import { createClerkClient, ClerkAPIResponseError } from '@clerk/backend';
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

    // Revoke in Clerk (but don't fail if it doesn't exist - it's already gone)
    try {
      await clerk.invitations.revokeInvitation(invite.clerkInvitationId);
      console.log(`[Admin] Revoked Clerk invitation ${invite.clerkInvitationId}`);
    } catch (clerkError) {
      // If invitation not found in Clerk (404), that's OK - it's already expired/revoked
      if (clerkError instanceof ClerkAPIResponseError && clerkError.status === 404) {
        console.warn(`[Admin] Invitation not found in Clerk (already expired): ${invite.clerkInvitationId}`);
      } else {
        throw clerkError;
      }
    }

    // Update in MongoDB
    invite.state = 'revoked';
    await invite.save();
    console.log(`[Admin] Updated invite state to revoked: ${inviteId}`);

    return { ok: true };
  } catch (error) {
    const result = toState(error);
    console.error(`[revokeParentInvite] Error:`, result);
    return result;
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
        console.log(`[Admin] Revoked old invitation: ${invite.clerkInvitationId}`);
      } catch (error) {
        // If it doesn't exist, that's fine
        if (error instanceof ClerkAPIResponseError && error.status === 404) {
          console.warn(`[Admin] Old invitation not found in Clerk: ${invite.clerkInvitationId}`);
        } else {
          console.warn(`[Admin] Failed to revoke old invitation`, error);
        }
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
    const result = toState(error);
    console.error(`[resendParentInvite] Error:`, result);
    return result;
  }
}
