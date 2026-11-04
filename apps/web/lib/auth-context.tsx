"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { MeResponse } from "@lms/shared";
import { api, ApiError, setUnauthorizedHandler } from "./api-client";
import {
  clearSession,
  readStoredUser,
  readToken,
  subscribeToSession,
  writeSession,
  type StoredUser,
} from "./session";

/**
 * The one place the app knows who is signed in.
 *
 * Replaces the TanStack query that used to be mounted by every guard: there is
 * exactly one `/me` request per page load, it happens only when a token exists,
 * and its result lives here as plain React state. No cache, no refetch policy,
 * no invalidation — the provider is the state.
 *
 * Access is decided by the API: `user.home` and `user.role` come from `/me`, and
 * nothing here invents a role from localStorage.
 */

export type AuthState = {
  /** `false` until the browser has been checked for a token. */
  ready: boolean;
  signedIn: boolean;
  user: MeResponse | null;
  /** A `/me` request is in flight (after sign-in or a manual refresh). */
  loading: boolean;
  /**
   * The provider has finished deciding: either there is a user, or there is
   * definitely no usable session. Guards redirect only once this is `true`.
   */
  settled: boolean;
  /** `/me` failed for a reason other than "not signed in". */
  error: string | null;
  /** Re-read the profile from the API. */
  refresh: () => Promise<void>;
  /** Store the token from `/auth/*`, then load the profile. */
  completeSignIn: (token: string, user: StoredUser) => Promise<MeResponse>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * The last profile the API returned, held for the lifetime of the tab. A
 * remount (navigating after sign-in) adopts it instead of asking `/me` again.
 * It is keyed by token, so a different account can never inherit it.
 */
let lastProfile: { token: string; me: MeResponse } | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  /*
   * The token lives in `localStorage`, which does not exist during the static
   * export's prerender. Read through `useSyncExternalStore` so the server
   * snapshot is `null` and the client switches to the real value after
   * hydration — the guards never see a wrong "signed out" on the first paint.
   */
  const token = useSyncExternalStore(subscribeToSession, readToken, () => null);
  const signedIn = token !== null;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to force a re-read without changing the token.
  const [refreshTick, setRefreshTick] = useState(0);

  /*
   * The profile belongs to one token. Keying the stored user by the token it
   * came from means signing out (or switching account) never shows stale state,
   * and nothing has to be cleared from an effect body.
   *
   * It starts from the profile this tab already fetched, so navigating after
   * sign-in does not ask `/me` a second time.
   */
  const [fetchedFor, setFetchedFor] = useState<{
    token: string;
    me: MeResponse;
  } | null>(() => lastProfile);
  const current =
    signedIn && token && fetchedFor?.token === token ? fetchedFor.me : null;
  const resolvedUser = current ?? user;
  const loading = Boolean(signedIn && token && !current && !error);

  const refresh = useCallback(async () => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setError(null);
    setFetchedFor(null);
    router.replace("/sign-in");
  }, [router]);

  // A 401 from any request means the stored token is dead: sign out once.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      lastProfile = null;
      setUser(null);
      setFetchedFor(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  /*
   * The single profile read. Runs on mount and whenever the token changes — and
   * never when there is no token, which is what used to fire a burst of 401s on
   * every page load.
   */
  useEffect(() => {
    if (!signedIn || !token) return;

    /*
     * `fetchedFor` was seeded from the profile sign-in already loaded, so the
     * next mount returns here instead of asking again — one `/me` per session,
     * not one per page.
     */

    if (fetchedFor?.token === token) return;

    let cancelled = false;

    api
      .get<MeResponse>("/me")
      .then((me) => {
        if (cancelled) return;
        lastProfile = { token, me };
        setFetchedFor({ token, me });
        setUser(me);
        setError(null);
        // Keep the name/email hint in storage in step with the API.
        writeSession(token, {
          id: me.id,
          name: me.name,
          email: me.email,
          role: me.role,
          status: me.status,
          onboarded: me.onboarded,
        });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        // A 401 already cleared the session above; report anything else.
        if (caught instanceof ApiError && caught.status === 401) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Your account could not be loaded",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, token, fetchedFor, refreshTick]);

  const completeSignIn = useCallback(
    async (nextToken: string, nextUser: StoredUser) => {
      writeSession(nextToken, nextUser);
      // Read the profile before navigating: `home` decides the destination and
      // the guards need it on the very next render.
      const me = await api.get<MeResponse>("/me");
      lastProfile = { token: nextToken, me };
      setFetchedFor({ token: nextToken, me });
      setUser(me);
      writeSession(nextToken, {
        id: me.id,
        name: me.name,
        email: me.email,
        role: me.role,
        status: me.status,
        onboarded: me.onboarded,
      });
      return me;
    },
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready: typeof window !== "undefined",
      signedIn,
      user: resolvedUser,
      loading,
      settled:
        typeof window !== "undefined" &&
        !loading &&
        (!signedIn || resolvedUser !== null),
      error,
      refresh,
      completeSignIn,
      signOut,
    }),
    [signedIn, resolvedUser, loading, error, refresh, completeSignIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** The stored hint, for places that render before `/me` settles. */
export function useStoredUser(): StoredUser {
  return readStoredUser();
}
