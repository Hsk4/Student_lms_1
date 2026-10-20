'use server';

import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { ParentInvite } from '@/models/parent-invite';
import { getCurrentUser } from '@/lib/auth/roles';

/**
 * Debug action - shows parent's linked children and invite status
 */
export async function getParentDebugInfo() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'parent') throw new Error('Not a parent');

    await connectDB();

    const parent = await User.findOne({ clerkId: user.clerkId, role: 'parent' })
      .select('_id clerkId email name')
      .lean();

    if (!parent) throw new Error('Parent not found');

    // Find all invites for this parent
    const invites = await ParentInvite.find({ parentEmail: parent.email })
      .populate('studentId', 'name email')
      .lean();

    // Find all students where parent is in guardianIds
    const linkedStudents = await User.find({
      role: 'student',
      'student.guardianIds': parent._id,
    })
      .select('name email')
      .lean();

    return {
      ok: true,
      parent: {
        id: String(parent._id),
        clerkId: parent.clerkId,
        email: parent.email,
        name: parent.name,
      },
      invites: invites.map((inv: any) => ({
        id: String(inv._id),
        studentName: inv.studentId?.name,
        studentEmail: inv.studentId?.email,
        state: inv.state,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
      })),
      linkedStudents: linkedStudents.map((s: any) => ({
        id: String(s._id),
        name: s.name,
        email: s.email,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
