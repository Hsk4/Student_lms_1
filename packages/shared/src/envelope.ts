/**
 * The wire shape of every API response. Replaces the old server-action
 * `ActionState`: `{ ok: true, data }` or `{ ok: false, error }`.
 */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export const API_ERRORS = {
  unauthorized: "Unauthorized: not signed in",
  forbidden: "Unauthorized: missing role or not active",
  notFound: "Not found",
  validation: "Invalid input",
  internal: "Something went wrong",
} as const;
