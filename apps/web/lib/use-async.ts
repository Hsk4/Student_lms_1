"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api-client";

/**
 * The two hooks every screen needs. This is deliberately the whole data layer:
 * a component either reads something (once, then on demand) or sends something.
 *
 * No global cache, no stale time, no invalidation graph. When a mutation
 * changes what a screen shows, that screen calls its own `reload()` — the cost
 * is an explicit line of code instead of a cache key that silently decides
 * when a request fires.
 */

export type AsyncResult<T> = {
  data: T | undefined;
  error: Error | null;
  /** First load, or a reload, still in flight. */
  loading: boolean;
  /** First load finished (successfully or not). */
  fetched: boolean;
  reload: () => void;
};

type QueryOptions = {
  /** `false` skips the request entirely (id is empty, no session, ...). */
  enabled?: boolean;
  /** Milliseconds between background refreshes. Omitted means never. */
  interval?: number;
};

/**
 * Read a GET endpoint.
 *
 * `deps` is the real dependency list: when any value changes, the request
 * re-runs. This replaces bespoke query keys — the values are read directly.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  { enabled = true, interval }: QueryOptions = {},
): AsyncResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [fetched, setFetched] = useState(false);
  const [tick, setTick] = useState(0);

  /*
   * `loading` describes the request that is actually outstanding, so it is
   * derived rather than set from the effect body: a new `runId` means "asking
   * now", and the `.finally` below moves to the next one when it settles.
   */
  const runId = JSON.stringify([tick, deps]);
  const [settledRun, setSettledRun] = useState<string | null>(null);
  const loading = enabled && settledRun !== runId;

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // The fetcher closes over props and state; calling it in the effect reads
    // the values this run was started with.
    fetcher()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      })
      .finally(() => {
        if (cancelled) return;
        setFetched(true);
        setSettledRun(runId);
      });

    return () => {
      cancelled = true;
    };
    // `deps` is the caller's dependency list, spread on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, runId, ...deps]);

  useEffect(() => {
    if (!enabled || !interval) return;
    const id = window.setInterval(() => {
      fetcher()
        .then((value) => {
          setData(value);
          setError(null);
        })
        .catch((caught: unknown) => {
          setError(caught instanceof Error ? caught : new Error(String(caught)));
        });
    }, interval);
    return () => window.clearInterval(id);
    // Restart the timer when the query key changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, runId]);

  return { data, error, loading, fetched, reload };
}

/** Shorthand: `useApi("/admin/users", { q })`. */
export function useApi<T>(
  path: string,
  query?: Record<string, string | number | undefined | null>,
  options: QueryOptions & { deps?: readonly unknown[] } = {},
): AsyncResult<T> {
  const { deps = [], ...rest } = options;
  const key = `${path}?${JSON.stringify(query ?? {})}`;
  return useAsync<T>(() => api.get<T>(path, query), [key, ...deps], rest);
}

export type ActionResult = {
  /** A submit is in flight. */
  pending: boolean;
  error: string | null;
  /** Run the action; returns the value, or `undefined` if it threw. */
  run: <R>(action: () => Promise<R>) => Promise<R | undefined>;
  reset: () => void;
};

/**
 * Send a request from a form. Replaces `useMutation` + `invalidateQueries`:
 * the form refreshes the list itself via the `reload()` the page passed in.
 */
export function useAction(onDone?: () => void): ActionResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <R,>(action: () => Promise<R>) => {
      setPending(true);
      setError(null);
      try {
        const value = await action();
        onDone?.();
        return value;
      } catch (caught: unknown) {
        setError(
          caught instanceof Error ? caught.message : "Something went wrong",
        );
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [onDone],
  );

  const reset = useCallback(() => setError(null), []);

  return { pending, error, run, reset };
}
