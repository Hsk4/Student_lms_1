#!/usr/bin/env node

/**
 * Promote an already registered local account to the first super admin.
 *
 * This intentionally does not create an account or set a password. The owner
 * must sign up first, then run this one-time bootstrap command from Render
 * Shell (or with the API environment loaded locally).
 *
 * Usage:
 *   bun run --cwd apps/api seed:super-admin muhammadhhammad2006@gmail.com
 */

import { eq, sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { users } from "@/db/schema";

const email = process.argv[2]?.trim().toLowerCase();

async function seedSuperAdmin() {
  if (!email) {
    throw new Error("Usage: bun run --cwd apps/api seed:super-admin <email>");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new Error(
      `No account found for ${email}. Sign up with this email first, then run the command again.`,
    );
  }

  if (user.role === "super_admin" && user.status === "active" && user.onboarded) {
    console.log(`${email} is already an active super admin; no changes made.`);
    return;
  }

  await db
    .update(users)
    .set({
      role: "super_admin",
      status: "active",
      onboarded: true,
      // Revoke any pending-user token so the promoted account signs in again
      // and receives a fresh session reflecting its new role.
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, user.id));

  console.log(`Promoted ${email} to active super admin.`);
  console.log("Sign out and sign in again to receive the super-admin session.");
}

seedSuperAdmin()
  .catch((error: unknown) => {
    console.error("Super-admin seed failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
