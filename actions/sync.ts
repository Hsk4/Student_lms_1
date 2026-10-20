'use server';

import { createClerkClient } from '@clerk/backend';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { requireRole } from '@/lib/auth/guards';
import { toState, type ActionState } from '@/lib/actions';

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('Missing CLERK_SECRET_KEY');
const clerk = createClerkClient({ secretKey });

/**
 * Syncs users between Clerk and MongoDB:
 * 1. Fetches all active Clerk users
 * 2. Marks any MongoDB users NOT in Clerk as deleted
 * Returns count of changes made
 */
export async function syncUsersWithClerk(): Promise<ActionState<{ deleted: number; synced: number }>> {
  try {
    await requireRole(['super_admin']);
    await connectDB();

    // Fetch all Clerk users
    const clerkUsers = await clerk.users.getUserList({ limit: 500 });
    const clerkUserIds = new Set(clerkUsers.data.map((u) => u.id));

    console.log(`[Sync] Found ${clerkUsers.data.length} users in Clerk`);

    // Find MongoDB users NOT in Clerk
    const mongoUsers = await User.find({}).select('clerkId _id').lean();
    const usersToDelete = mongoUsers.filter((u) => !clerkUserIds.has(u.clerkId));

    console.log(`[Sync] Found ${usersToDelete.length} users in MongoDB not in Clerk`);

    if (usersToDelete.length > 0) {
      const deleteResult = await User.deleteMany({
        _id: { $in: usersToDelete.map((u) => u._id) },
      });

      console.log(`[Sync] Deleted ${deleteResult.deletedCount} users from MongoDB`);

      return {
        ok: true,
        data: {
          deleted: deleteResult.deletedCount,
          synced: clerkUsers.data.length,
        },
      };
    }

    return {
      ok: true,
      data: {
        deleted: 0,
        synced: clerkUsers.data.length,
      },
    };
  } catch (error) {
    return toState(error);
  }
}
