"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-context";
import { webHomeFor } from "./role-home";
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
  nextStepHref,
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
  /** Sign-up only: forward the chosen role to `/pending`. */
  nextStepHref?: string;
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
      // `webHomeFor` sends a parent to the link page instead of the empty
      // children dashboard; every other role keeps the API's `home`.
      const home = webHomeFor(me.home);
      router.replace(
        nextStepHref && home.startsWith("/pending")
          ? `${home}?next=${encodeURIComponent(nextStepHref)}`
          : home,
      );
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

/** The roles an account can ask for at sign-up. Students use the plain form. */
export type SignUpRole = "student" | "teacher" | "parent";

export function SignUp({
  signInUrl = "/sign-in",
  role = "student",
}: {
  signInUrl?: string;
  fallbackRedirectUrl?: string;
  /**
   * Which application the new account is for. It only chooses the wording and
   * where the account lands next (the `/request` form); the API still decides
   * what the account may do, and an admin still approves the role.
   */
  role?: SignUpRole;
}) {
  const wording =
    role === "teacher"
      ? {
          title: "Create your teacher account",
          subtitle:
            "Next you will fill in a short teaching application. An admin reviews it before your classes open.",
        }
      : role === "parent"
        ? {
            title: "Create your parent account",
            subtitle:
              "Next you will tell us who your child is. An admin reviews it before your dashboard opens.",
          }
        : {
            title: "Create your school account",
            subtitle:
              "Your role is confirmed by the school office after you request access.",
          };

  return (
    <AuthForm
      title={wording.title}
      subtitle={wording.subtitle}
      submitLabel="Create account"
      busyLabel="Creating account..."
      endpoint="sign-up"
      /*
       * A brand-new role-less account lands on `/pending` (the API's `home`).
       * Carrying the chosen door through tells that page which application the
       * person meant to fill in, instead of making them pick again.
       */
      nextStepHref={
        role === "teacher"
          ? "/request?role=teacher"
          : role === "parent"
            ? "/request?role=parent"
            : undefined
      }
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
