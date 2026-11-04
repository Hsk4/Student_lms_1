"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";

/**
 * Root client providers.
 *
 * There is no global data cache: the session lives in `AuthProvider` and every
 * screen owns the data it fetches (`lib/use-async.ts`). "Which request runs
 * when" is answerable by reading the page.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
