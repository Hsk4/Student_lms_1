"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, UserRole } from "@lms/shared";
import { useAuth } from "@/lib/auth";
import { PanelSkeleton } from "@/components/shared/skeleton";
import { ApiError } from "./api-client";
import { useMe } from "./queries";

/**
 * Client panel guard. UX only: it mirrors the old `checkAccess` /
 * `requirePanelUser` redirects, but the API is the real gate.
 *
 * - not signed in -> /sign-in
 * - not active, wrong role, or a student who has not onboarded -> the account's
 *   home page from the API (`homeFor`)
 * - suspended -> /?error=account_suspended (that is what `home` says)
 */
export function usePanelGuard(roles: UserRole[]) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const me = useMe();

  // The API answers 403 (with the home page in the message) for an account that
  // is pending, rejected or not onboarded; `/me` itself is open to those.
  const notReady = me.error instanceof ApiError && me.error.status === 403;
  // The local session can be present before the first `/me` load settles. A 401
  // here means we still need to wait for the API to accept the stored token.
  const sessionSettling =
    isSignedIn && me.error instanceof ApiError && me.error.status === 401;

  let redirectTo: string | null = null;
  if (isLoaded && !isSignedIn) redirectTo = "/sign-in";
  else if (me.data) {
    const user = me.data;
    /*
     * A role is the approval. `pending` only holds an account back when it has
     * no role yet; a seeded or admin-assigned account (the first super admin)
     * lands in its own panel. `user.home` already encodes this.
     */
    if (!user.role || !roles.includes(user.role)) {
      redirectTo = user.home;
    } else if (user.role === "student" && !user.onboarded) {
      redirectTo = "/onboarding/parent";
    }
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const allowed = !redirectTo && !notReady && me.data !== undefined;
  const denied = redirectTo !== null;
  const loading = !isLoaded || me.isLoading || Boolean(sessionSettling && !me.data);
  return { user: me.data, allowed, denied, isLoading: loading };
}

export function PanelLoading() {
  return <PanelSkeleton />;
}

/**
 * Renders children only once the guard has passed.
 *
 * `denied` means a redirect is on its way (still signed in, wrong area or
 * status), so the spinner is honest. Without it the API refused the account
 * while the redirect does not apply (e.g. a pending user opening a panel):
 * saying so beats a permanent "Loading...".
 */
export function Guarded({
  allowed,
  denied = false,
  isLoading,
  children,
}: {
  allowed: boolean;
  denied?: boolean;
  isLoading: boolean;
  children: ReactNode;
}) {
  if (isLoading || denied) return <PanelLoading />;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm font-medium text-foreground">This area is not available yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account may be waiting for approval.
        </p>
        <a href="/pending" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Check your status
        </a>
      </div>
    );
  }
  return <>{children}</>;
}

/** The page-level check for an unauthenticated form: sign in first. */
export function useSignedInOnly() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  return {
    user: me.data as MeResponse | undefined,
    isLoading: !isLoaded || me.isLoading,
  };
}
