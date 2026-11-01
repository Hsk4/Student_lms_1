#!/usr/bin/env node

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun scripts/seed-super-admin.ts <email>");
  process.exit(1);
}

async function seedSuperAdmin() {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!row) {
    console.error(`No local user found with email: ${normalized}`);
    process.exit(1);
  }

  await db
    .update(users)
    .set({ role: "super_admin", status: "active", onboarded: true })
    .where(eq(users.id, row.id));

  console.log(`Promoted local user ${row.id} to super_admin`);
  process.exit(0);
}

seedSuperAdmin().catch((error) => {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
