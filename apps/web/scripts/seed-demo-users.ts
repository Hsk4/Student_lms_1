#!/usr/bin/env node
/** Usage: npx tsx --env-file=.env.local scripts/seed-demo-users.ts */
import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Demo accounts for local role switching (`LMS_DEMO_ROLE`). Postgres-backed and
 * idempotent: `users_clerk_id_unique` is the conflict target, so a re-run only
 * refreshes the display fields.
 *
 * `postgres-js` keeps its pool open, so the process is ended explicitly at the
 * end instead of relying on `process.exit`.
 */
const demo = [
  {
    clerkId: "demo_admin",
    email: "admin@fastly.test",
    name: "Ayesha Khan",
    role: "admin",
  },
  {
    clerkId: "demo_teacher",
    email: "teacher@fastly.test",
    name: "Bilal Ahmed",
    role: "teacher",
  },
  {
    clerkId: "demo_student",
    email: "student@fastly.test",
    name: "Hamza Ali",
    role: "student",
  },
  {
    clerkId: "demo_parent",
    email: "parent@fastly.test",
    name: "Sana Ali",
    role: "parent",
  },
] as const;

async function main() {
  for (const account of demo) {
    await db
      .insert(users)
      .values({
        clerkId: account.clerkId,
        email: account.email,
        name: account.name,
        role: account.role,
        status: "active",
        onboarded: true,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email: sql`excluded.email`,
          name: sql`excluded.name`,
          role: sql`excluded.role`,
          status: sql`excluded.status`,
          onboarded: sql`excluded.onboarded`,
        },
      });
    console.log("seeded", account.email);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end({ timeout: 5 }));
