"use client";

import type { ReactNode } from "react";
import { Providers } from "@/lib/providers";
import { AuthRedirector } from "./auth-redirector";

/**
 * Root client shell: local auth, TanStack Query, and the signed-in redirect.
 */
export function RootShell({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AuthRedirector />
      {children}
    </Providers>
  );
}
