import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, createLocalSessionToken } from "@/middleware/auth";
import { freshStatus, me, myRequestStatus } from "@/controllers/me";
import { requestParentAccess, submitAccessRequest } from "@/controllers/onboarding";
import { findUserByEmail, findUserCredentialsByEmail, createUser } from "@/db/queries/users";
import { ok } from "@/lib/respond";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

/*
 * 10 attempts per 15 minutes per IP is the production rule. A test run signs in
 * many times on purpose, so the limit is configurable — never raised in
 * production, where the default stands.
 */
const authAttemptLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_ATTEMPT_LIMIT ?? 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many authentication attempts. Try again later." },
});

const passwordResetRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many reset requests. Try again later." },
});

const passwordResetSubmitLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many reset attempts. Try again later." },
});

const hashResetToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

// A syntactically valid dummy hash keeps unknown accounts on the same scrypt
// verification path as accounts with an incorrect password.
const DUMMY_PASSWORD_HASH = "scrypt$MDEyMzQ1Njc4OWFiY2RlZg$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const meRoutes = Router();

// The onboarding routes must answer for a pending, rejected or not-onboarded
// account; everything else requires an active, onboarded one (see `auth`).
const restricted = auth({ allowRestricted: true });

meRoutes.post(
  "/auth/sign-in",
  authAttemptLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password are required" });
      return;
    }

    if (password.length > 128) {
      res.status(400).json({ ok: false, error: "Password must be 128 characters or fewer" });
      return;
    }

    const credentials = await findUserCredentialsByEmail(email);
    const user = credentials?.user ?? null;
    const passwordMatches = await verifyPassword(
      password,
      credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const token = createLocalSessionToken({
      sub: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      onboarded: user.onboarded,
      sessionVersion: credentials?.sessionVersion ?? 0,
    });

    ok(res, {
      token,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        onboarded: user.onboarded,
      },
    });
  }),
);

meRoutes.post(
  "/auth/sign-up",
  authAttemptLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const name = String(req.body?.name ?? "User").trim() || "User";

    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password are required" });
      return;
    }
    if (password.length < 12 || password.length > 128) {
      res.status(400).json({ ok: false, error: "Password must be between 12 and 128 characters" });
      return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: "Enter a valid email address" });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ ok: false, error: "An account with that email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      passwordHash,
      clerkId: `local-${email.replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      email,
      name,
      role: null,
      status: "pending",
      onboarded: false,
    });

    const token = createLocalSessionToken({
      sub: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      onboarded: user.onboarded,
    });

    ok(res, {
      token,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        onboarded: user.onboarded,
      },
    });
  }),
);

meRoutes.post(
  "/auth/forgot-password",
  passwordResetRequestLimit,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: "Enter a valid email address" });
      return;
    }

    // Always return the same response so callers cannot discover registered emails.
    const user = await findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(token);
      await db
        .update(users)
        .set({
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        })
        .where(eq(users.id, user.id));

      try {
        await sendPasswordResetEmail({ to: user.email, name: user.name, token });
      } catch (error) {
        // Never log the reset token. This should be monitored as an email delivery failure.
        console.error("[auth] password reset email delivery failed", error);
      }
    }

    ok(res, {
      message: "If an account exists for that email, a password reset link will be sent.",
    });
  }),
);

meRoutes.post(
  "/auth/reset-password",
  passwordResetSubmitLimit,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!token || token.length > 256) {
      res.status(400).json({ ok: false, error: "This password reset link is invalid or has expired." });
      return;
    }
    if (password.length < 12 || password.length > 128) {
      res.status(400).json({ ok: false, error: "Password must be between 12 and 128 characters." });
      return;
    }

    const tokenHash = hashResetToken(token);
    const now = new Date();
    const [matchingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.passwordResetTokenHash, tokenHash),
        gt(users.passwordResetExpiresAt, now),
      ))
      .limit(1);

    if (!matchingUser) {
      res.status(400).json({ ok: false, error: "This password reset link is invalid or has expired." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(and(
        eq(users.id, matchingUser.id),
        eq(users.passwordResetTokenHash, tokenHash),
        gt(users.passwordResetExpiresAt, new Date()),
      ))
      .returning({ id: users.id });

    if (!updated) {
      res.status(400).json({ ok: false, error: "This password reset link is invalid or has expired." });
      return;
    }

    ok(res, { message: "Your password has been reset. Please sign in again." });
  }),
);

meRoutes.get(
  "/me",
  restricted,
  asyncHandler(async (req, res) => ok(res, await me(req))),
);
meRoutes.get(
  "/me/request",
  restricted,
  asyncHandler(async (req, res) => ok(res, await myRequestStatus(req))),
);
meRoutes.post(
  "/me/request",
  restricted,
  asyncHandler(async (req, res) => {
    await submitAccessRequest(req);
    ok(res, null);
  }),
);
meRoutes.post(
  "/me/request/parent",
  restricted,
  asyncHandler(async (req, res) => {
    await requestParentAccess(req);
    ok(res, null);
  }),
);
meRoutes.get(
  "/me/status",
  restricted,
  asyncHandler(async (req, res) => ok(res, await freshStatus(req))),
);

export const healthRoutes = Router();
healthRoutes.get("/health", (_req, res) => ok(res, { status: "ok" }));
