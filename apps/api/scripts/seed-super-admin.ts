#!/usr/bin/env node

/**
 * Create (or reconcile) the initial super-admin account.
 *
 * Idempotent: run it as often as you like. If the email already exists the row
 * is reconciled (role/status/password) in place, never duplicated.
 *
 * The password is read from the environment and hashed with the same scrypt
 * helper the sign-up route uses. It is never printed, logged, or written to a
 * file. Neither is the hash.
 *
 * Which database it touches is decided entirely by `DATABASE_URL` in the loaded
 * environment file — there is no default and no fallback to a production host.
 * Point it at local Postgres for development, or load the Render environment to
 * run it against production (see the README).
 *
 * Usage (from apps/api):
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD='...' \
 *     bun run seed:super-admin
 *
 * PowerShell:
 *   $env:SUPER_ADMIN_EMAIL="you@example.com"
 *   $env:SUPER_ADMIN_PASSWORD="..."
 *   bun run seed:super-admin
 */

import { eq, sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;

/** Same rule the sign-up route enforces: 12-128 characters. */
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 128;

function fail(message: string): never {
  // Only ever names variables, never their values.
  throw new Error(message);
}

async function seedSuperAdmin() {
  if (!email) fail("SUPER_ADMIN_EMAIL is required");
  if (!password) fail("SUPER_ADMIN_PASSWORD is required");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    fail(
      `SUPER_ADMIN_PASSWORD must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters`,
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("SUPER_ADMIN_EMAIL is not a valid email address");
  }
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is not set: refusing to guess which database to seed");
  }

  // The database host only, so the operator can see which target is in play.
  const host = new URL(process.env.DATABASE_URL).host;
  console.log(`Seeding super admin ${email} into ${host}`);

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      /*
       * Reconcile, do not duplicate. `sessionVersion` is bumped so tokens
       * minted before this run (with the old role or status) stop working and
       * the account has to sign in once more.
       */
      await tx
        .update(users)
        .set({
          role: "super_admin",
          status: "active",
          onboarded: true,
          rejectionReason: null,
          rejectedAt: null,
          passwordHash,
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(eq(users.id, existing.id));
      console.log(
        `Reconciled existing account (${existing.role ?? "no role"} -> super_admin).`,
      );
      return;
    }

    /*
     * Same identity convention as `POST /auth/sign-up`: a local, unique
     * `clerkId`. The column name is historical; the value is generated here.
     */
    await tx.insert(users).values({
      clerkId: `local-${email.replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      email,
      name: "Super Admin",
      role: "super_admin",
      status: "active",
      onboarded: true,
      passwordHash,
      sessionVersion: 0,
    });
    console.log("Created the account.");
  });

  console.log("Done. Sign in with SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.");
}

seedSuperAdmin()
  .catch((error: unknown) => {
    console.error(
      "Super-admin seed failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
