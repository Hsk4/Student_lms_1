"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@lms/shared";
import { api, ApiError } from "./api-client";

/**
 * TanStack Query hooks over the API. One hook per screen, named after the
 * screen; a mutation invalidates the hooks it can affect.
 */

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/me"),
    // A 401/403 is an answer, not a transient failure: retrying only delays
    // the guard's redirect.
    retry: (count, error) => !(error instanceof ApiError) && count < 2,
  });
}

/** Polls /me every 5 seconds until the account is decided (the pending page). */
export function useMePolling(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/me"),
    refetchInterval: enabled ? 5000 : false,
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
