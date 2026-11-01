import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import { homeFor, type UserRole, type UserStatus } from "@lms/shared";
import { clerkClient, metadataOf } from "@/lib/clerk";
import { forbidden, notReady, unauthorized } from "@/lib/http-error";
import { createUser, findUserByClerkId } from "@/db/queries/users";
import type { GateUser } from "@lms/shared";

/**
 * Token -> account. Mirrors `getCurrentUser` from the old `lib/auth/roles.ts`:
 * the Postgres mirror is authoritative for role/status; a token whose row is
 * missing is adopted from Clerk so a fresh sign-up is never stuck.
 */

export const AUTH_VERIFIER = Symbol("auth-verifier");

/** Verifies a bearer token and returns the session. Swappable in tests. */
export type TokenVerifier = (
  token: string,
) => Promise<{
  clerkId: string;
  metadata: { role?: string | null; status?: string; onboarded?: boolean };
}>;

export function clerkTokenVerifier(): TokenVerifier {
  return async (token) => {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      clockSkewInMs: Number(process.env.CLERK_CLOCK_SKEW_MS ?? 5000),
    });
    if (!payload.sub) throw new Error("Token has no subject");
    return { clerkId: payload.sub, metadata: metadataOf(payload) };
  };
}

function toGateUser(
  row: NonNullable<Awaited<ReturnType<typeof findUserByClerkId>>>,
): GateUser {
  return {
    id: row.id,
    clerkId: row.clerkId,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    onboarded: row.onboarded,
    rejectionReason: row.rejectionReason,
    rejectedAt: row.rejectedAt,
  };
}

async function resolveUser(clerkId: string): Promise<GateUser | null> {
  let row = await findUserByClerkId(clerkId);

  if (!row) {
    try {
      const clerkUser = await clerkClient().users.getUser(clerkId);
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        "";
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "User";
      row = await createUser({
        clerkId,
        email,
        name,
        role: null,
        status: "pending",
        onboarded: false,
      });
    } catch {
      // A concurrent webhook may have won the race on `users_clerk_id_unique`.
      row = await findUserByClerkId(clerkId);
    }
  }

  return row ? toGateUser(row) : null;
}

/**
 * The Clerk lookup failed, but the token verified: the account is a real
 * sign-up whose webhook has not landed. Treat it as pending (the product rule
 * for missing metadata) and check the mirror again first, so a user who was
 * just assigned a role is not demoted by a transient Clerk error.
 */
async function adoptOrPending(clerkId: string): Promise<GateUser> {
  return (
    (await findUserByClerkId(clerkId).then((row) => (row ? toGateUser(row) : null))) ?? {
      id: clerkId,
      clerkId,
      email: "",
      name: "User",
      role: null,
      status: "pending",
      onboarded: false,
    }
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: GateUser;
      /** Set for every token that verifies, even before the mirror row exists. */
      clerkId?: string;
    }
  }
}

/**
 * Verifies the bearer token and loads the account. Missing metadata is treated
 * as `pending`. A suspended account is refused everywhere; a `pending`,
 * `rejected` or not-onboarded account only passes the onboarding routes, which
 * opt in with `allowRestricted`.
 */
export function auth(opts: { allowRestricted?: boolean } = {}) {
  const restricted = opts.allowRestricted ?? false;

  return async (req: Request, _res: Response, next: NextFunction) => {
    // Resolved per request: `createApp` installs the verifier once the app is built.
    const verify =
      (globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER] ??
      clerkTokenVerifier();
    try {
      const header = req.headers.authorization ?? "";
      const [scheme, token] = header.split(" ");
      if (scheme !== "Bearer" || !token) {
        throw unauthorized();
      }

      let session: Awaited<ReturnType<TokenVerifier>>;
      try {
        session = await verify(token);
      } catch {
        throw unauthorized();
      }

      req.clerkId = session.clerkId;
      const user = (await resolveUser(session.clerkId)) ?? (await adoptOrPending(session.clerkId));
      req.user = user;

      if (user.status === "suspended") {
        throw notReady("Unauthorized: account is suspended");
      }

      if (restricted) return next();

      // Authenticated but not usable yet: 403, with the page the client should
      // send the user to. Suspended is refused above; `homeFor` would say
      // "/?error=account_suspended" here, which is for the web, not the API.
      if (user.status !== "active") {
        throw notReady(`Account is ${user.status}: ${homeFor(user)}`);
      }
      if (user.role === "student" && !user.onboarded) {
        throw notReady(`Account needs onboarding: ${homeFor(user)}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(unauthorized());
    if (user.status !== "active" || !user.role || !roles.includes(user.role)) {
      return next(
        forbidden(
          `Unauthorized: role ${user.role ?? "none"} not in ${roles.join(", ")}`,
        ),
      );
    }
    next();
  };
}

/** The signed-in account, guaranteed by `auth`. */
export function actorOf(req: Request): GateUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export type { UserRole, UserStatus };
