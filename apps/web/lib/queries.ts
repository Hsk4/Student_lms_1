"use client";

import { api } from "./api-client";
import {
  useAction,
  useApi,
  useAsync,
  type ActionResult,
  type AsyncResult,
} from "./use-async";

/**
 * Backwards-compatible names for the data layer in `use-async.ts`.
 *
 * New code should import `useApi` / `useAsync` / `useAction` directly. These
 * aliases exist so screens can move over one at a time.
 */

export type { ActionResult, AsyncResult };

export const useApiQuery = useApi;
export const useApiMutation = useAction;

/** The signed-in account. Read from `AuthProvider` — it is the only reader. */
export { useAuth as useMe } from "./auth-context";

/**
 * Poll a GET endpoint while a screen waits on a server-side decision (the
 * pending page). Stops as soon as the screen unmounts.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  enabled: boolean,
  intervalMs = 5000,
): AsyncResult<T> {
  return useAsync<T>(fetcher, deps, {
    enabled,
    interval: enabled ? intervalMs : undefined,
  });
}

/** @deprecated Use `usePolling`. */
export function useMePolling(enabled: boolean) {
  return usePolling(() => api.get("/me"), [], enabled);
}
