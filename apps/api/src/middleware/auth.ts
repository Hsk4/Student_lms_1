import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { homeFor, type UserRole, type UserStatus } from "@lms/shared";
import { forbidden, notReady, unauthorized } from "@/lib/http-error";
import { findUserByClerkId } from "@/db/queries/users";
import type { GateUser } from "@lms/shared";

/**
 * Token -> account. The Postgres row is authoritative for role/status, and a
 * verified token without a local row is treated as a pending account instead of
 * depending on any hosted identity provider.
 */

export const AUTH_VERIFIER = Symbol("auth-verifier");

/** Verifies a bearer token and returns the session. Swappable in tests. */
export type TokenVerifier = (
  token: string,
) => Promise<{
  clerkId: string;
  metadata: { role?: string | null; status?: string; onboarded?: boolean };
}>;

function getAuthSecret() {
  const secret =
    process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "local-dev-secret-change-me";

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.AUTH_JWT_SECRET &&
    !process.env.JWT_SECRET
  ) {
    throw new Error("AUTH_JWT_SECRET or JWT_SECRET is required in production");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createLocalSessionToken(payload: {
  sub: string;
  email?: string;
  name?: string;
  role?: string | null;
  status?: string;
  onboarded?: boolean;
}) {
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

export function localTokenVerifier(): TokenVerifier {
  return async (token) => {
    const segments = token.split(".");
    if (segments.length !== 3) throw new Error("Invalid JWT format");

    const [headerB64, payloadB64, signature] = segments;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expected = crypto
      .createHmac("sha256", getAuthSecret())
      .update(signingInput)
      .digest("base64url");

    const actual = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (actual.length !== expectedBuf.length || !crypto.timingSafeEqual(actual, expectedBuf)) {
      throw new Error("JWT signature mismatch");
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload.sub) throw new Error("Token has no subject");

    return {
      clerkId: String(payload.sub),
      metadata: {
        role: payload.role ?? null,
        status: payload.status ?? "pending",
        onboarded: Boolean(payload.onboarded),
      },
    };
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
  const row = await findUserByClerkId(clerkId);
  return row ? toGateUser(row) : null;
}

/**
 * The token verified, but the account row is still missing. Treat the user as a
 * pending local account so the first sign-in or sign-up can proceed without any
 * hosted identity provider.
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
      localTokenVerifier();
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
