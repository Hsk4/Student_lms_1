import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { closeDb, db } from "@/db";
import { users } from "@/db/schema";
import { createApp } from "@/app";
import { createLocalSessionToken, localTokenVerifier } from "@/middleware/auth";
import { verifyPassword } from "@/lib/password";
import { authHeader, resetDb, seedUser, testVerifier } from "./helpers";

let app: Express;

beforeAll(() => {
  app = createApp({ verifyToken: testVerifier });
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe("authentication", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: expect.any(String) });
  });

  it("returns 401 for a token the verifier rejects", async () => {
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Bearer not-a-test-token");
    expect(res.status).toBe(401);
  });

  it("returns the account for an active user", async () => {
    const user = await seedUser({ clerkId: "admin_1", role: "admin" });
    const res = await request(app).get("/api/v1/me").set(authHeader("admin_1"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      id: user.id,
      role: "admin",
      status: "active",
      home: "/admin",
    });
  });

  it("blocks a suspended account with 403 on every guarded route", async () => {
    await seedUser({
      clerkId: "suspended_1",
      role: "admin",
      status: "suspended",
    });
    const res = await request(app)
      .get("/api/v1/me")
      .set(authHeader("suspended_1"));
    expect(res.status).toBe(403);
  });

  it("lets a pending account load /me (it needs its home redirect)", async () => {
    await seedUser({
      clerkId: "pending_1",
      status: "pending",
      onboarded: false,
    });
    const res = await request(app)
      .get("/api/v1/me")
      .set(authHeader("pending_1"));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "pending",
      home: "/pending",
    });
  });

  it("reports a rejected account's reason and re-apply window", async () => {
    const rejectedAt = new Date("2026-09-01T00:00:00Z");
    await seedUser({
      clerkId: "rejected_1",
      status: "rejected",
      onboarded: false,
      rejectedAt,
      rejectionReason: "Not a student of this school",
    });
    const res = await request(app)
      .get("/api/v1/me/request")
      .set(authHeader("rejected_1"));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "rejected",
      rejectionReason: "Not a student of this school",
      rejectedAt: rejectedAt.toISOString(),
    });
    expect(res.body.data).not.toHaveProperty("home");
  });

  it("serves /health without a token", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { status: "ok" } });
  });
});

describe("mirror adoption", () => {
  it("treats a verified token with no account row as pending", async () => {
    // The verifier accepts the token but no `users` row exists for it. Missing
    // metadata is pending: /me answers with the pending home, and no panel is
    // reachable.
    const res = await request(app).get("/api/v1/me").set(authHeader("ghost_1"));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "pending", role: null, home: "/pending" });

    const blocked = await request(app)
      .get("/api/v1/student/courses")
      .set(authHeader("ghost_1"));
    expect(blocked.status).toBe(403);

    const rows = await db.select().from(users).where(eq(users.clerkId, "ghost_1"));
    expect(rows).toHaveLength(0);
  });
});

describe("local JWT auth", () => {
  it("accepts an HMAC-signed local token", async () => {
    const token = createLocalSessionToken({
      sub: "local-admin-1",
      email: "admin@school.test",
      name: "Local Admin",
      role: "super_admin",
      status: "active",
      onboarded: true,
      sessionVersion: 7,
    });

    const session = await localTokenVerifier()(token);
    expect(session).toMatchObject({
      clerkId: "local-admin-1",
      metadata: { role: "super_admin", status: "active", onboarded: true },
      sessionVersion: 7,
    });
  });

  it("revokes previously issued JWTs when the account session version changes", async () => {
    await seedUser({ clerkId: "session-reset-user", role: "student" });
    const token = createLocalSessionToken({
      sub: "session-reset-user",
      sessionVersion: 0,
    });
    await db
      .update(users)
      .set({ sessionVersion: 1 })
      .where(eq(users.clerkId, "session-reset-user"));

    try {
      const jwtApp = createApp({ verifyToken: localTokenVerifier() });
      const res = await request(jwtApp)
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    } finally {
      createApp({ verifyToken: testVerifier });
    }
  });

  it("rejects the demo super-admin backdoor", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "admin@demo.local", password: "demo123" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: "Invalid email or password" });
  });

  it("stores a password hash and only signs in with the correct password", async () => {
    const signup = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Alice Student", email: "alice@school.test", password: "correct-horse-battery" });

    expect(signup.status).toBe(200);
    const [stored] = await db.select().from(users).where(eq(users.email, "alice@school.test"));
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", stored.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", stored.passwordHash)).toBe(false);

    const wrong = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "alice@school.test", password: "wrong-password" });
    expect(wrong.status).toBe(401);

    const correct = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "alice@school.test", password: "correct-horse-battery" });
    expect(correct.status).toBe(200);
    expect(correct.body.data.token).toBeTypeOf("string");
  });

  it("rejects sign-in for legacy accounts without a password hash", async () => {
    await seedUser({ clerkId: "legacy-user", email: "legacy@school.test" });
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "legacy@school.test", password: "any-password-at-all" });
    expect(res.status).toBe(401);
  });

  it("rejects JWTs without an expiry claim", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "no-expiry" })).toString("base64url");
    const input = `${header}.${payload}`;
    const secret = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET ?? "local-dev-secret-change-me";
    const signature = crypto.createHmac("sha256", secret).update(input).digest("base64url");
    await expect(localTokenVerifier()(`${input}.${signature}`)).rejects.toThrow();

    const expiredPayload = Buffer.from(JSON.stringify({ sub: "expired", exp: 1 })).toString("base64url");
    const expiredInput = `${header}.${expiredPayload}`;
    const expiredSignature = crypto.createHmac("sha256", secret).update(expiredInput).digest("base64url");
    await expect(localTokenVerifier()(`${expiredInput}.${expiredSignature}`)).rejects.toThrow(/expired/);
  });

  it("sends a one-time reset link, changes the password, and invalidates old password hashes", async () => {
    // Existing users from before local passwords have no password_hash yet.
    await seedUser({ clerkId: "legacy-reset-user", email: "reset@school.test" });

    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.AUTH_EMAIL_FROM = "Fastly LMS <no-reply@example.test>";
    process.env.WEB_APP_URL = "https://lms.example.test";
    let emailPayload: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      emailPayload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const forgot = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "reset@school.test" });
      expect(forgot.status).toBe(200);
      expect(forgot.body.data.message).toContain("If an account exists");
      expect(fetchMock).toHaveBeenCalledOnce();

      const emailText = String(emailPayload?.text ?? "");
      const resetLink = emailText.split("\n").find((line) => line.startsWith("https://"));
      expect(resetLink).toBeTruthy();
      const resetToken = new URL(resetLink!).searchParams.get("token");
      expect(resetToken).toBeTruthy();

      const reset = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, password: "replacement-password" });
      expect(reset.status).toBe(200);

      const reused = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, password: "another-new-password" });
      expect(reused.status).toBe(400);

      const oldPassword = await request(app)
        .post("/api/v1/auth/sign-in")
        .send({ email: "reset@school.test", password: "original-password" });
      expect(oldPassword.status).toBe(401);

      const newPassword = await request(app)
        .post("/api/v1/auth/sign-in")
        .send({ email: "reset@school.test", password: "replacement-password" });
      expect(newPassword.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.RESEND_API_KEY;
      delete process.env.AUTH_EMAIL_FROM;
      delete process.env.WEB_APP_URL;
    }
  });

  it("returns the same forgot-password response for an unknown email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@school.test" });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("If an account exists");
  });

  it("mints a token for a real local sign-up", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Alice Student", email: "alice@school.test", password: "strong-secret" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toBeTypeOf("string");
    expect(res.body.data.user).toMatchObject({
      email: "alice@school.test",
      name: "Alice Student",
      role: null,
      status: "pending",
    });
  });
});
