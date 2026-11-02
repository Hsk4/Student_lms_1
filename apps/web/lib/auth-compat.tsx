"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "lms-auth-token";
const STORAGE_USER_KEY = "lms-auth-user";

type StoredUser = {
  id?: number | string;
  name?: string;
  email?: string;
  role?: string | null;
  status?: string;
  onboarded?: boolean;
} | null;

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY) ?? null;
}

function readStoredUser(): StoredUser {
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

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const signedIn = typeof window !== "undefined" && Boolean(readStoredToken());

  const getToken = useCallback(async () => {
    if (!signedIn) return null;
    return readStoredToken();
  }, [signedIn]);

  const signOut = useCallback(async () => {
    clearDemoSession();
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
  const user = readStoredUser();
  const initials = (user?.name ?? "User")
    .split(" ")
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "A";

  return (
    <button
      type="button"
      onClick={async () => {
        clearDemoSession();
        router.push("/sign-in");
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      aria-label="Sign out"
      title={user?.email ? `${user.name ?? "User"} • ${user.email}` : "Sign out"}
    >
      {initials}
    </button>
  );
}

async function finishAuthentication(
  token: string,
  router: ReturnType<typeof useRouter>,
  queryClient: ReturnType<typeof useQueryClient>,
  fallbackRedirectUrl: string,
  user: StoredUser,
) {
  writeStoredSession(token, user);
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      data?: { home?: string; [key: string]: unknown };
    };
    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error ?? "Your account could not be loaded");
    }

    // The root shell may already have cached an unauthenticated /me response.
    // Replace that cache before navigating, so the role redirect is immediate.
    queryClient.setQueryData(["me"], payload.data);
    const destination =
      fallbackRedirectUrl && fallbackRedirectUrl !== "/"
        ? fallbackRedirectUrl
        : payload.data.home || "/pending";
    router.replace(destination);
  } catch (error) {
    clearDemoSession();
    throw error;
  }
}

export function SignIn({
  signUpUrl = "/sign-up",
  fallbackRedirectUrl = "/",
}: {
  signUpUrl?: string;
  fallbackRedirectUrl?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      window.alert("Email and password are required");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const response = await fetch(`${baseUrl}/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { token?: string; user?: StoredUser };
      };

      if (!response.ok || !payload.ok || !payload.data?.token) {
        throw new Error(payload.error ?? "Unable to sign in");
      }

      await finishAuthentication(
        payload.data.token,
        router,
        queryClient,
        fallbackRedirectUrl,
        payload.data.user ?? null,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in";
      window.alert(message);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Sign in to your workspace
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your school account to continue.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@school.edu"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </label>

        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </label>

        <div className="text-right text-sm">
          <Link href="/forgot-password/" className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Continue
        </button>
      </form>

      {signUpUrl ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Need a new account? <Link href={signUpUrl} className="font-medium text-primary">Create one</Link>
        </p>
      ) : null}
    </div>
  );
}

export function SignUp({
  signInUrl = "/sign-in",
  fallbackRedirectUrl = "/",
}: {
  signInUrl?: string;
  fallbackRedirectUrl?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    if (!name || !email || !password) {
      window.alert("Name, email and password are required");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const response = await fetch(`${baseUrl}/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: { token?: string };
      };

      if (!response.ok || !payload.ok || !payload.data?.token) {
        throw new Error(payload.error ?? "Unable to create account");
      }

      await finishAuthentication(
        payload.data.token,
        router,
        queryClient,
        fallbackRedirectUrl,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account";
      window.alert(message);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Create your school account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your role is confirmed by the school office after you request access.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Full name</span>
          <input name="name" autoComplete="name" required placeholder="Your name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Email</span>
          <input name="email" type="email" autoComplete="email" required placeholder="you@school.edu" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="At least 12 characters" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <button type="submit" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          Create account
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account? <Link href={signInUrl} className="font-medium text-primary">Sign in</Link>
      </p>
    </div>
  );
}
