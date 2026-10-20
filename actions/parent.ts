'use server';

import { createClerkClient } from '@clerk/backend';
import type { ClientSession } from 'mongoose';
import { connectDB, withTransaction } from '@/lib/db';
import { User } from '@/models/user';
import { ParentInvite } from '@/models/parent-invite';
import { writeAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/roles';
import { studentParentSchema, acceptInviteSchema } from '@/lib/validators/parent';
import { toState, type ActionState } from '@/lib/actions';

const secretKey = process.env.CLERK_SECRET_KEY;
const clerk = secretKey ? createClerkClient({ secretKey }) : null;

/** Create the Mongo mirror and let Clerk deliver and manage the invitation. */
export async function createParentInvite(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(['student']);
    const input = studentParentSchema.parse(raw);
    if (!clerk) throw new Error('Missing CLERK_SECRET_KEY');
    await connectDB();

    const student = await User.findOne({ clerkId: actor.clerkId, role: 'student', status: 'active' });
    if (!student) throw new Error('Student account not found');

    const existingUser = await User.findOne({ email: input.parentEmail }).select('_id role status').lean();
    if (existingUser) {
      throw new Error(existingUser.role === 'parent'
        ? 'This email already has a parent account. Ask them to sign in; linking existing accounts is not enabled.'
        : 'This email belongs to an existing account. Ask an admin for help.');
    }
    const openInvite = await ParentInvite.findOne({ parentEmail: input.parentEmail, state: 'sent' }).lean();
    if (openInvite) throw new Error('An invitation is already open for this email. Ask the parent to check their inbox.');

    const invitation = await clerk.invitations.createInvitation({
      emailAddress: input.parentEmail,
      expiresInDays: 7,
      ignoreExisting: false,
      publicMetadata: {
        role: 'parent',
        status: 'active',
        onboarded: true,
        studentId: String(student._id),
        parentName: input.parentName,
      },
    });

    try {
      await withTransaction(async (dbSession: ClientSession) => {
        const [invite] = await ParentInvite.create([{
          studentId: student._id,
          parentName: input.parentName,
          parentEmail: input.parentEmail,
          clerkInvitationId: invitation.id,
          state: 'sent',
        }], { session: dbSession });
        await writeAudit({
          actorId: student._id,
          action: 'createParentInvite',
          targetType: 'ParentInvite',
          targetId: invite._id,
          after: { studentId: String(student._id), parentEmail: input.parentEmail, clerkInvitationId: invitation.id },
        }, dbSession);
      });
    } catch (error) {
      try {
        await clerk.invitations.revokeInvitation(invitation.id);
      } catch (revokeError) {
        console.error('Failed to revoke Clerk invitation after Mongo write failure', revokeError);
      }
      throw error;
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create invitation';
    const existing = /already|exists|invitation/i.test(message);
    return toState(new Error(existing
      ? 'This email already has an account or open invitation. Ask them to sign in; existing-account linking is not enabled.'
      : message));
  }
}

export type InviteDetails = {
  parentName: string;
  parentEmail: string;
  studentName: string;
  acceptingEmail: string | null;
  message: string;
};

/** Informational route: Clerk owns invitation validation and acceptance. */
export async function getInviteDetails(invitationId: string): Promise<InviteDetails | null> {
  const parsed = acceptInviteSchema.safeParse({ invitationId });
  if (!parsed.success) return null;
  await connectDB();
  const invite = await ParentInvite.findOne({ clerkInvitationId: parsed.data.invitationId }).lean();
  if (!invite) return null;
  const [student, user] = await Promise.all([
    User.findById(invite.studentId).select('name').lean(),
    getCurrentUser(),
  ]);
  const email = user?.email.toLowerCase() ?? null;
  const message = invite.state === 'accepted'
    ? 'Your invitation has been accepted and the student link is active.'
    : invite.state === 'revoked' || (invite.expiresAt && invite.expiresAt <= new Date())
      ? 'This invitation has expired or was revoked. Ask the student to send a new one.'
      : !user
        ? 'Complete sign-up from the Clerk invitation email using the invited email address.'
        : email !== invite.parentEmail.toLowerCase()
          ? `This invitation is for ${invite.parentEmail}. Sign in with that account.`
          : 'Clerk will activate your parent account; its webhook links the student after sign-up.';

  return {
    parentName: invite.parentName,
    parentEmail: invite.parentEmail,
    studentName: student?.name ?? 'Student',
    acceptingEmail: email,
    message,
  };
}
