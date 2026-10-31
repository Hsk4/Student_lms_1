"use server";

import { createClerkClient } from "@clerk/backend";
import { requireRole } from "@/lib/auth/guards";
import { deleteUsersNotIn } from "@/lib/queries/users";
import { toState, type ActionState } from "@/lib/actions";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");
const clerk = createClerkClient({ secretKey });

/**
 * Syncs users between Clerk and Postgres:
 * 1. Fetches all active Clerk users
 * 2. Deletes any Postgres users NOT in Clerk
 *
 * Returns count of changes made.
 *
 * Deletion goes through one `NOT IN` statement rather than reading every row
 * into the application, and it relies on the foreign keys: a user with
 * enrollments, invoices or audit entries is `onDelete: restrict`, so the delete
 * fails loudly instead of silently orphaning history.
 */
export async function syncUsersWithClerk(): Promise<
  ActionState<{ deleted: number; synced: number }>
> {
  try {
    await requireRole(["super_admin"]);

    // Fetch all Clerk users
    const clerkUsers = await clerk.users.getUserList({ limit: 500 });
    const clerkUserIds = clerkUsers.data.map((u) => u.id);

    console.log(`[Sync] Found ${clerkUsers.data.length} users in Clerk`);

    const deletedIds = await deleteUsersNotIn(clerkUserIds);

    console.log(
      `[Sync] Deleted ${deletedIds.length} users from Postgres not in Clerk`,
    );

    return {
      ok: true,
      data: { deleted: deletedIds.length, synced: clerkUsers.data.length },
    };
  } catch (error) {
    return toState(error);
  }
}
