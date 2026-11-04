"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-context";
import { readStoredUser, type StoredUser } from "./session";

/**
 * Local authentication: a bearer JWT in `localStorage`, the API as the only
 * authority on role and status, and the account's `home` deciding where it
 * lands. Nothing here trusts a stored role — the profile is always re-read
 * from `/me` after sign-in and on every panel load.
 */

export type { StoredUser } from "./session";

export const DEV_API_URL = "http://localhost:4000/api/v1";

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || DEV_API_URL;
}

/** @deprecated Import from `@/lib/auth-context`. */
export { AuthProvider, useAuth } from "./auth-context";

export function UserButton() {
  const { signOut } = useAuth();
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
        // The provider clears the session and navigates. Pages reload their own
        // data on mount, so nothing from this account can leak to the next.
        signOut();
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

type AuthPayload = {
  ok?: boolean;
  error?: string;
  data?: { token?: string; user?: StoredUser; home?: string };
};



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
  const { completeSignIn } = useAuth();
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

      // Stores the token, then loads `/me` (which decides the destination).
      const me = await completeSignIn(
        payload.data.token,
        payload.data.user ?? null,
      );
      router.replace(me.home || "/pending");
    } catch (caught) {
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
