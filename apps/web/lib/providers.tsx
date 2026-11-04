"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearLocalSession, useAuth } from "@/lib/auth";
import {
  ApiError,
  setSessionExpiredHandler,
  setTokenGetter,
} from "./api-client";

/**
 * Hands the local session token to the fetch wrapper and owns the QueryClient.
 * A 401 is reported by `api-client`; this component reacts to it once.
 */
export function Providers({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [expired, setExpired] = useState(0);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, error) =>
              // An HTTP answer (401/403/404) will not change on retry.
              !(error instanceof ApiError) && count < 2,
          },
        },
      }),
  );

  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    /*
     * Session expiry: clear the token and drop every cached query, so the next
     * account never inherits this one's data. The redirect happens below,
     * through the router — the app is a client-only static export, so routing
     * must not be a full page load.
     */
    setSessionExpiredHandler(() => {
      clearLocalSession();
      queryClient.clear();
      setExpired((count) => count + 1);
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  useEffect(() => {
    if (expired === 0) return;
    router.replace("/sign-in?reason=session_expired");
  }, [expired, router]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
