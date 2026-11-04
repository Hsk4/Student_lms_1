"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api-client";

/**
 * TEMPORARY. Keeps the screens that have not migrated yet working.
 *
 * The auth layer and the data hooks used by new code (`useAsync`, `useApi`,
 * `useAction`) do not touch this. As each page moves off `useQuery` /
 * `useMutation`, this file shrinks; when the last one is gone, delete the
 * component and the dependency.
 *
 * One client per mount, created lazily so the static export's prerender does
 * not share a cache between pages.
 */
export function LegacyQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // An HTTP answer will not change on a retry; only a network
            // failure (status 0) is worth retrying.
            retry: (count, error) =>
              !(error instanceof ApiError && error.status > 0) && count < 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
