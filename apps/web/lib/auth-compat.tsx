"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "fastly-demo-auth";
const STORAGE_USER_KEY = "fastly-demo-user";
const DEMO_TOKEN = "demo-super-admin";
const DEMO_USER = {
  name: "Demo Super Admin",
  email: "admin@demo.local",
  role: "super_admin",
  status: "active",
};

export function isLocalAuthConfigured() {
  return true;
}

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY) ?? null;
}

function readStoredUser() {
  if (typeof window === "undefined") return DEMO_USER;
  try {
    const raw = window.localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : DEMO_USER;
  } catch {
    return DEMO_USER;
  }
}

export function getDemoToken() {
  return readStoredToken() ?? DEMO_TOKEN;
}

export function setDemoSession(
  email = DEMO_USER.email,
  tokenOverride?: string,
  userOverride?: Partial<typeof DEMO_USER>,
) {
  const normalized = email.trim().toLowerCase();
  const token = tokenOverride ?? DEMO_TOKEN;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, token);
    window.localStorage.setItem(
      STORAGE_USER_KEY,
      JSON.stringify({
        name: userOverride?.name ?? normalized.split("@")[0] ?? "Demo User",
        email: userOverride?.email ?? normalized,
        role: userOverride?.role ?? "super_admin",
        status: userOverride?.status ?? "active",
      }),
    );
  }

  return token;
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
  const signedIn =
    typeof window === "undefined"
      ? !isLocalAuthConfigured()
      : Boolean(readStoredToken() || isLocalAuthConfigured());

  const getToken = useCallback(async () => {
    if (!signedIn) return null;
    return getDemoToken();
  }, [signedIn]);

  const signOut = useCallback(async () => {
    clearDemoSession();
  }, []);

  return {
    isLoaded: true,
    isSignedIn: signedIn,
    getToken,
    signOut,
  };
}

export function UserButton() {
  const router = useRouter();
  const user = readStoredUser();
  const initials = user.name
    .split(" ")
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={async () => {
        clearDemoSession();
        router.push("/sign-in");
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      aria-label="Sign out"
      title={`${user.name} • ${user.email}`}
    >
      {initials || "A"}
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
    const email = String(form.get("email") || DEMO_USER.email);
    const password = String(form.get("password") || "demo123");

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
          user?: typeof DEMO_USER;
        };
      };

      if (!response.ok || !payload.ok || !payload.data?.token) {
        throw new Error(payload.error ?? "Unable to sign in");
      }

      setDemoSession(email, payload.data.token, payload.data.user);
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
        Use the local API account or the demo admin account for development.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={DEMO_USER.email}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </label>

        <label className="block text-sm text-foreground">
          <span className="mb-1.5 block">Password</span>
          <input
            name="password"
            type="password"
            defaultValue="demo123"
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
