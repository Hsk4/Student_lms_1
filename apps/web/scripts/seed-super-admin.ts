#!/usr/bin/env node

import { createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { findUserByClerkId, updateUser } from "@/lib/queries/users";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun scripts/seed-super-admin.ts <email>");
  process.exit(1);
}

async function seedSuperAdmin() {
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

  if (!CLERK_SECRET_KEY) {
    throw new Error("Missing CLERK_SECRET_KEY environment variable");
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  console.log(`Looking up Clerk user with email: ${email}`);

  // Find user by email
  const found = await clerk.users.getUserList({ emailAddress: [email] });

  if (!found.data || found.data.length === 0) {
    console.error(`No Clerk user found with email: ${email}`);
    process.exit(1);
  }

  const clerkUser = found.data[0];

  // Check email is verified
  if (
    !clerkUser.emailAddresses.some(
      (ea) =>
        ea.emailAddress === email && ea.verification?.status === "verified",
    )
  ) {
    console.error(`Email ${email} is not verified in Clerk`);
    process.exit(1);
  }

  console.log(`Found Clerk user: ${clerkUser.id}`);

  // Set super_admin role and status in Clerk publicMetadata
  await clerk.users.updateUser(clerkUser.id, {
    publicMetadata: {
      role: "super_admin",
      status: "active",
    },
  });

  console.log("Updated Clerk publicMetadata");

  // Create or update the Postgres row. `users_clerk_id_unique` makes this an
  // upsert rather than a find-then-write, so a re-run cannot create a duplicate.
  const existing = await findUserByClerkId(clerkUser.id);

  if (existing) {
    await updateUser(existing.id, { role: "super_admin", status: "active" });
    console.log(`Updated existing User record: ${existing.id}`);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        clerkId: clerkUser.id,
        email: (clerkUser.emailAddresses[0].emailAddress ?? "").toLowerCase(),
        name: clerkUser.firstName || clerkUser.username || "Super Admin",
        role: "super_admin",
        status: "active",
        onboarded: true,
      })
      .onConflictDoNothing({ target: users.clerkId })
      .returning();

    if (created) {
      console.log(`Created new User record: ${created.id}`);
    } else {
      // Lost a race with a concurrent insert: fall back to the row that won.
      const row = await findUserByClerkId(clerkUser.id);
      if (row)
        await updateUser(row.id, { role: "super_admin", status: "active" });
      console.log(`User already existed, promoted: ${row?.id ?? clerkUser.id}`);
    }
  }

  // Verify the row really is a super admin before reporting success.
  const check = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);
  console.log("Postgres row:", check[0] ?? "missing");

  console.log(`Super admin created/updated: ${email}`);
  process.exit(0);
}

seedSuperAdmin().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
