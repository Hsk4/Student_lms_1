"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/clerk-react";
import type { MeResponse, UserRole } from "@lms/shared";
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

  let redirectTo: string | null = null;
  if (isLoaded && !isSignedIn) redirectTo = "/sign-in";
  else if (me.data) {
    const user = me.data;
    if (user.status !== "active" || !user.role || !roles.includes(user.role)) {
      redirectTo = user.home;
    } else if (user.role === "student" && !user.onboarded) {
      redirectTo = "/onboarding/parent";
    }
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const allowed = !redirectTo && Boolean(me.data);
  return { user: me.data, allowed, isLoading: !isLoaded || me.isLoading };
}

export function PanelLoading() {
  return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;
}

/** Renders children only once the guard has passed. */
export function Guarded({
  allowed,
  isLoading,
  children,
}: {
  allowed: boolean;
  isLoading: boolean;
  children: ReactNode;
}) {
  if (isLoading || !allowed) return <PanelLoading />;
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
