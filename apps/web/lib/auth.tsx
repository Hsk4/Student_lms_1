"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

/**
 * Local authentication: a bearer JWT in `localStorage`, the API as the only
 * authority on role and status, and the account's `home` deciding where it
 * lands. Nothing here trusts a stored role — the profile is always re-read
 * from `/me` after sign-in and on every panel load.
 */

const STORAGE_KEY = "lms-auth-token";
const STORAGE_USER_KEY = "lms-auth-user";

export type StoredUser = {
  id?: number | string;
  name?: string;
  email?: string;
  role?: string | null;
  status?: string;
  onboarded?: boolean;
} | null;

export const DEV_API_URL = "http://localhost:4000/api/v1";

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || DEV_API_URL;
}

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY) ?? null;
}

export function readStoredUser(): StoredUser {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(token: string, user: StoredUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
  if (user) {
    window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_USER_KEY);
  }
}

/** Drop the token and the cached profile. Safe to call when signed out. */
export function clearLocalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  const isLoaded = typeof window !== "undefined";
  const signedIn = isLoaded && Boolean(readStoredToken());

  // Read storage at call time so an API request made immediately after
  // sign-in never depends on a stale React closure from the signed-out render.
  const getToken = useCallback(async () => readStoredToken(), []);

  const signOut = useCallback(async () => {
    clearLocalSession();
  }, []);

  return {
    isLoaded,
    isSignedIn: signedIn,
    getToken,
    signOut,
  };
}

export function UserButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = readStoredUser();
  const initials =
    (user?.name ?? "User")
      .split(" ")
      .map((part: string) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A";

  return (
    <button
      type="button"
      onClick={() => {
        clearLocalSession();
        // Cached queries are keyed without the user id; drop them all so the
        // next account never sees this one's data.
        queryClient.clear();
        router.replace("/sign-in");
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      aria-label="Sign out"
      title={
        user?.email ? `${user.name ?? "User"} • ${user.email}` : "Sign out"
      }
    >
      {initials}
    </button>
  );
}

type MeData = { home?: string; [key: string]: unknown };

type AuthPayload = {
  ok?: boolean;
  error?: string;
  data?: { token?: string; user?: StoredUser; home?: string };
};

/**
 * Ask the API where the account belongs. The returned `home` is computed
 * server-side from role/status, so the browser never decides access.
 */
export async function fetchHome(token: string): Promise<MeData> {
  const response = await fetch(`${apiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let payload: { ok?: boolean; error?: string; data?: MeData } | null = null;
  try {
    payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: MeData;
    };
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error ?? "Your account could not be loaded");
  }
  return payload.data;
}

function AuthForm({
  title,
  subtitle,
  submitLabel,
  busyLabel,
  fields,
  endpoint,
  footer,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  busyLabel: string;
  fields: {
    name: string;
    label: string;
    type: string;
    autoComplete: string;
    placeholder: string;
    extra?: Record<string, unknown>;
  }[];
  endpoint: "sign-in" | "sign-up";
  footer: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Controlled fields: a failed submission must not wipe what was typed.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])),
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);

    const body = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        key === "email" ? value.trim().toLowerCase() : value,
      ]),
    );

    setPending(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let payload: AuthPayload | null = null;
      try {
        payload = (await response.json()) as AuthPayload;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.ok || !payload.data?.token) {
        throw new Error(
          payload?.error ?? `Unable to ${submitLabel.toLowerCase()}`,
        );
      }

      writeStoredSession(payload.data.token, payload.data.user ?? null);
      const me = await fetchHome(payload.data.token);
      // The root shell may already have cached an unauthenticated /me response.
      // Replace it before navigating so the redirect is immediate and correct.
      queryClient.setQueryData(["me"], me);
      router.replace(me.home || "/pending");
    } catch (caught) {
      // Keep the token only if the follow-up /me call was what failed; the
      // next load rehydrates from it.
      if (!readStoredToken()) clearLocalSession();
      setError(
        caught instanceof Error
          ? caught.message
          : `Unable to ${submitLabel.toLowerCase()}`,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {fields.map((field) => (
          <label key={field.name} className="block text-sm text-foreground">
            <span className="mb-1.5 block">{field.label}</span>
            <input
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              required
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              aria-invalid={error ? true : undefined}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
              {...field.extra}
            />
          </label>
        ))}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? busyLabel : submitLabel}
        </Button>
      </form>

      {footer}
    </div>
  );
}

export function SignIn({
  signUpUrl = "/sign-up",
  notice,
}: {
  signUpUrl?: string;
  /** A server-side message already known on load, e.g. an expired session. */
  notice?: string | null;
  /** Kept for call-site compatibility; the API's `home` always wins. */
  fallbackRedirectUrl?: string;
}) {
  return (
    <>
      {notice ? (
        <p
          role="status"
          className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {notice}
        </p>
      ) : null}
      <AuthForm
        title="Sign in to your workspace"
        subtitle="Use your school account to continue."
        submitLabel="Continue"
        busyLabel="Signing in..."
        endpoint="sign-in"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "username",
            placeholder: "you@school.edu",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
            placeholder: "Enter your password",
          },
        ]}
        footer={
          <div className="mt-4 space-y-2 text-center text-sm">
            <Link
              href="/forgot-password/"
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
            {signUpUrl ? (
              <p className="text-muted-foreground">
                Need a new account?{" "}
                <Link href={signUpUrl} className="font-medium text-primary">
                  Create one
                </Link>
              </p>
            ) : null}
          </div>
        }
      />
    </>
  );
}

export function SignUp({
  signInUrl = "/sign-in",
}: {
  signInUrl?: string;
  fallbackRedirectUrl?: string;
}) {
  return (
    <AuthForm
      title="Create your school account"
      subtitle="Your role is confirmed by the school office after you request access."
      submitLabel="Create account"
      busyLabel="Creating account..."
      endpoint="sign-up"
      fields={[
        {
          name: "name",
          label: "Full name",
          type: "text",
          autoComplete: "name",
          placeholder: "Your name",
        },
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@school.edu",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          placeholder: "At least 12 characters",
          extra: { minLength: 12, maxLength: 128 },
        },
      ]}
      footer={
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={signInUrl} className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      }
    />
  );
}
