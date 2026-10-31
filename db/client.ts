import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The single place the app obtains a Postgres connection.
 *
 * This replaces `lib/db.ts`'s Mongoose cache and its Windows SRV/DNS workaround
 * (not needed: `postgres-js` resolves the host via the driver's own connection
 * string parser, and Neon does not require SRV lookups).
 *
 * The client is cached on `globalThis` because Next.js dev server reloads
 * modules on every edit; without the cache each reload leaks a connection pool.
 */

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;

type Db = PostgresJsDatabase<typeof schema>;

declare global {
  var __lmsSql: ReturnType<typeof postgres> | undefined;
  var __lmsDb: Db | undefined;
}

function connectionString(): string {
  if (!CONNECTION_STRING) {
    throw new Error(
      "Missing DATABASE_URL (or DATABASE_URL_UNPOOLED) environment variable",
    );
  }
  return CONNECTION_STRING;
}

function client() {
  if (!global.__lmsSql) {
    global.__lmsSql = postgres(connectionString(), {
      // A pooled endpoint in transaction mode cannot take prepared statements.
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
    });
  }
  return global.__lmsSql;
}

/** The Drizzle instance. Import this, never construct your own. */
export const db: Db = global.__lmsDb ?? drizzle(client(), { schema });

/** The underlying `postgres-js` client, for scripts that must close the pool. */
export const sqlClient = client();

if (!global.__lmsDb) {
  global.__lmsDb = db;
}

/** The transaction handle passed to `db.transaction(cb)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
