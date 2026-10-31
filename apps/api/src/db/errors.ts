/**
 * Postgres error inspection.
 *
 * Drizzle wraps driver errors: a failed `insert` throws a plain `Error` whose
 * message is "Failed query: ..." with no `code`, and the real `PostgresError`
 * (carrying SQLSTATE) sits on `.cause`. Checking `error.code` directly — which
 * is what the old Mongoose `code === 11000` check did — therefore never matches.
 *
 * Always classify database errors through these helpers.
 */

/** Well-known SQLSTATE codes used by the app. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
} as const;

type PostgresErrorLike = {
  code?: string;
  constraint_name?: string;
  detail?: string;
};

/**
 * Returns the `PostgresError` underneath a Drizzle error, or null.
 * Walks `.cause` because Drizzle adds its own wrapper and `postgres-js` may add
 * one more (`PostgresError` with `.cause`).
 */
export function postgresError(
  error: unknown,
  depth = 0,
): PostgresErrorLike | null {
  if (!error || typeof error !== "object" || depth > 5) return null;

  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string" && /^\d{5}$/.test(candidate.code)) {
    return candidate as PostgresErrorLike;
  }

  return postgresError(candidate.cause, depth + 1);
}

/** True when the failure is a unique-constraint violation, optionally on `constraint`. */
export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const pg = postgresError(error);
  if (!pg || pg.code !== PG_ERROR.UNIQUE_VIOLATION) return false;
  return constraint ? pg.constraint_name === constraint : true;
}

/** The constraint name that rejected the write, if any. Handy for messages. */
export function violatedConstraint(error: unknown): string | null {
  return postgresError(error)?.constraint_name ?? null;
}
