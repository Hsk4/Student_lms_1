"use client";

/**
 * The local session: one bearer token plus the last profile the API returned.
 *
 * This module owns nothing about React. It reads and writes `localStorage` and
 * notifies subscribers, so the provider, the API client and the sign-out button
 * all agree on one source of truth without anyone polling the server.
 *
 * Nothing here is trusted for access. The stored user is only a hint for the
 * first paint; the API re-reads the real profile on every load.
 */

const TOKEN_KEY = "lms-auth-token";
const USER_KEY = "lms-auth-user";

/** Fired in this tab when the token is written or cleared. */
const SESSION_CHANGED = "lms-auth-changed";

export type StoredUser = {
  id?: number | string;
  name?: string;
  email?: string;
  role?: string | null;
  status?: string;
  onboarded?: boolean;
} | null;

const isBrowser = () => typeof window !== "undefined";

export function readToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY) ?? null;
}

export function readStoredUser(): StoredUser {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export function writeSession(token: string, user: StoredUser) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

/** Drop the token and the cached profile. Safe to call when signed out. */
export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  // `storage` only fires in *other* tabs; this event covers this one.
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

/** Re-render subscribers when the session is written or cleared, in any tab. */
export function subscribeToSession(onChange: () => void) {
  window.addEventListener(SESSION_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
