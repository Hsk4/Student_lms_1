"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { LegacyQueryProvider } from "./legacy-query-compat";

/**
 * Root client providers.
 *
 * Auth has no cache: the session lives in `AuthProvider`, and every screen owns
 * the data it fetches (`lib/use-async.ts`). `LegacyQueryProvider` is a shim for
 * the screens still being migrated; it disappears with the last `useQuery`.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LegacyQueryProvider>{children}</LegacyQueryProvider>
    </AuthProvider>
  );
}
