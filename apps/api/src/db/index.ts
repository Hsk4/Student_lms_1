import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The single place the API obtains a Postgres connection.
 *
 * One process, one pool: the pool is created lazily on first use and closed by
 * `server.ts` on shutdown (and by the test harness between suites).
 *
 * The connection string is read once, at import time. The API is the only
 * service that talks to Postgres; the web app has no database code at all.
 */

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;

type Db = PostgresJsDatabase<typeof schema>;

function connectionString(): string {
  if (!CONNECTION_STRING) {
    throw new Error(
      "Missing DATABASE_URL (or DATABASE_URL_UNPOOLED) environment variable",
    );
  }
  return CONNECTION_STRING;
}

const sqlClient = postgres(connectionString(), {
  // A pooled endpoint in transaction mode cannot take prepared statements.
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  onnotice: () => {},
});

/** The Drizzle instance. Import this, never construct your own. */
export const db: Db = drizzle(sqlClient, { schema });

export { sqlClient };

/** Closes the pool. `server.ts` calls it on SIGINT/SIGTERM. */
export function closeDb(): Promise<void> {
  return sqlClient.end({ timeout: 5 });
}

/** The transaction handle passed to `db.transaction(cb)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
