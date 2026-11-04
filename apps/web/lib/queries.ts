"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@lms/shared";
import { api, ApiError } from "./api-client";
import { useAuth } from "./auth";

/**
 * TanStack Query hooks over the API. One hook per screen, named after the
 * screen; a mutation invalidates the hooks it can affect.
 */

/**
 * A 401/403 is an answer, not a transient failure: retrying only delays the
 * guard's redirect and prints another failed request per retry.
 */
const ANSWER_NOT_RETRIED = (count: number, error: Error) =>
  !(error instanceof ApiError) && count < 2;

export function useMe() {
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/me"),
    /*
     * Only ask while there is a session. Without this, every page that mounts a
     * guard (`AuthRedirector` is in the root shell, so that is all of them)
     * fired `/me` with no token: one 401 per mount, plus its retries, for a
     * visitor who was never going to be let in. Signed out is a known state, not
     * an API round trip. Sign-in primes this same key before navigating.
     */
    enabled: isSignedIn,
    retry: ANSWER_NOT_RETRIED,
  });
}

/** Polls /me every 5 seconds until the account is decided (the pending page). */
export function useMePolling(enabled: boolean) {
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/me"),
    enabled: Boolean(enabled) && isSignedIn,
    refetchInterval: enabled && isSignedIn ? 5000 : false,
    retry: ANSWER_NOT_RETRIED,
  });
}

export function useApiQuery<T>(
  key: unknown[],
  path: string,
  query?: Record<string, string | number | undefined | null>,
  enabled = true,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get<T>(path, query),
    enabled,
  });
}

/** A mutation that invalidates the given query keys on success. */
export function useApiMutation<TResult = unknown, TVars = void>(
  method: "post" | "patch" | "delete",
  path: (vars: TVars) => string,
  invalidate: unknown[][],
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: (vars: TVars) => {
      const body =
        method === "delete" ? vars : vars === undefined ? undefined : vars;
      return api[method]<TResult>(path(vars), body);
    },
    onSuccess: () => {
      for (const key of invalidate)
        queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
