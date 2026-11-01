"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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

export function SignIn({
  signUpUrl,
  fallbackRedirectUrl = "/",
}: {
  signUpUrl?: string;
  fallbackRedirectUrl?: string;
}) {
  const router = useRouter();

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
        data?: {
          token?: string;
          user?: StoredUser;
        };
      };

      if (!response.ok || !payload.ok || !payload.data?.token) {
        throw new Error(payload.error ?? "Unable to sign in");
      }

      writeStoredSession(payload.data.token, payload.data.user ?? null);
      router.replace(fallbackRedirectUrl);
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
            placeholder="you@school.edu"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </label>

        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Password</span>
          <input
            name="password"
            type="password"
            placeholder="Enter your password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </label>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Continue
        </button>
      </form>

      {signUpUrl ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Need a new account? <a href={signUpUrl} className="font-medium text-primary">Create one</a>
        </p>
      ) : null}
    </div>
  );
}

export function SignUp({
  signInUrl,
  fallbackRedirectUrl = "/",
}: {
  signInUrl?: string;
  fallbackRedirectUrl?: string;
}) {
  return (
    <SignIn
      signUpUrl={signInUrl}
      fallbackRedirectUrl={fallbackRedirectUrl}
    />
  );
}
