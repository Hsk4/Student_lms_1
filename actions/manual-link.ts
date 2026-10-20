'use server';

import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { ParentInvite } from '@/models/parent-invite';
import { getCurrentUser } from '@/lib/auth/roles';

/**
 * Manually link parent to student (repair action if webhook failed)
 */
export async function manuallyLinkParentToStudent(inviteId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'parent') throw new Error('Not a parent');

    await connectDB();

    const invite = await ParentInvite.findById(inviteId);
    if (!invite) throw new Error('Invite not found');

    const parent = await User.findOne({ clerkId: user.clerkId, role: 'parent' });
    if (!parent) throw new Error('Parent not found');

    const student = await User.findById(invite.studentId);
    if (!student) throw new Error('Student not found');

    // Check if already linked
    if (student.student?.guardianIds?.includes(parent._id)) {
      return { ok: true, message: 'Already linked' };
    }

    // Link parent to student
    await User.updateOne(
      { _id: student._id },
      { $addToSet: { 'student.guardianIds': parent._id } }
    );

    // Mark student as onboarded
    await User.updateOne(
      { _id: student._id },
      { $set: { onboarded: true } }
    );

    // Mark invite as accepted
    invite.state = 'accepted';
    invite.acceptedBy = parent._id;
    invite.acceptedAt = new Date();
    await invite.save();

    console.log(`[ManualLink] Linked parent ${parent._id} to student ${student._id}`);

    return { ok: true, message: `Successfully linked to ${student.name}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
