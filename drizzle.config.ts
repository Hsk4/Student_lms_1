import { defineConfig } from "drizzle-kit";

/**
 * Migrations run against the *unpooled* connection. A pooled Neon/PgBouncer
 * connection in transaction mode cannot hold the session state DDL needs.
 *
 * `db:generate` works offline; only `db:migrate` / `db:push` / `db:studio` need
 * DATABASE_URL to be set.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
