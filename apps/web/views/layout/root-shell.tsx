"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { Providers } from "@/lib/providers";
import { AuthRedirector } from "./auth-redirector";

/**
 * Root client shell: Clerk, TanStack Query, and the signed-in redirect.
 * Static export builds every page on the client, so nothing here reads the
 * server session; navigation is with `useRouter`.
 */
export function RootShell({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <div className="p-10 text-sm text-muted-foreground">
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      <Providers>
        <AuthRedirector />
        {children}
      </Providers>
    </ClerkProvider>
  );
}
