import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { closeDb, db } from "@/db";
import { users } from "@/db/schema";
import { createApp } from "@/app";
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

  it("returns 401 for a token Clerk rejects", async () => {
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
  it("treats a verified token with no mirror row as pending", async () => {
    // The verifier accepts the token but Clerk cannot be reached (placeholder
    // key), which is the "webhook has not landed" case. Missing metadata is
    // pending: /me answers with the pending home, and no panel is reachable.
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
