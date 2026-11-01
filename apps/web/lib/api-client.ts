"use client";

import type { ApiEnvelope } from "@lms/shared";

/**
 * The typed fetch wrapper for the API.
 *
 * Attaches the Clerk session token as `Authorization: Bearer`, unwraps the
 * `{ ok, data }` / `{ ok: false, error }` envelope, and throws `ApiError` on a
 * failure so TanStack Query treats it as an error. The base URL is the API's
 * `/api/v1`; set it once from `NEXT_PUBLIC_API_URL`.
 */

const DEV_API_URL = "http://localhost:4000/api/v1";

/**
 * `NEXT_PUBLIC_API_URL` is inlined at build time. A production bundle that
 * falls back to localhost is a build mistake, not a runtime condition — it
 * ships an app that can reach nothing — so it says so in the console once
 * instead of failing every request with an opaque `ERR_CONNECTION_REFUSED`.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEV_API_URL;

if (process.env.NODE_ENV === "production" && BASE_URL === DEV_API_URL) {
  console.error(
    "[api] NEXT_PUBLIC_API_URL is not set: this production build will call localhost. Rebuild with the hosted API URL.",
  );
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type GetToken = () => Promise<string | null>;

let getTokenRef: GetToken = async () => null;

/** Called once by the providers, with Clerk's `getToken`. */
export function setTokenGetter(getToken: GetToken) {
  getTokenRef = getToken;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
};

function withQuery(path: string, query?: RequestOptions["query"]) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, query }: RequestOptions = {},
): Promise<T> {
  const token = await getTokenRef();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${BASE_URL}${withQuery(path, query)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // A `TypeError` here is a network or CORS failure, not an HTTP status: the
    // browser withholds the response entirely when the API does not allow this
    // origin. Saying so beats "Failed to fetch" on every screen.
    throw new ApiError(0, `Cannot reach the school server at ${BASE_URL}.`);
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok === false) {
    const message =
      payload && payload.ok === false ? payload.error : "Something went wrong";
    throw new ApiError(response.status, message);
  }

  return payload.data;
}

/** Shorthand for the query functions. */
export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "DELETE", body }),
};
