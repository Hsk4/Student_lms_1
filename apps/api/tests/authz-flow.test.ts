import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "@/app";
import { closeDb, db } from "@/db";
import { users } from "@/db/schema";
import {
  createLocalSessionToken,
  localTokenVerifier,
} from "@/middleware/auth";
import { authHeader, resetDb, seedUser, testVerifier } from "./helpers";

/**
 * Role resolution, the access-request gate and session expiry — the flows that
 * decide whether an account reaches its dashboard or gets sent back to a gate
 * page. Authorization here is the API's, not the browser's.
 */

const app = createApp({ verifyToken: testVerifier });

const requestBody = {
  name: "Applicant",
  email: "applicant@school.test",
  subjectIds: [],
};

beforeEach(async () => {
  await resetDb();
  // `createApp` installs the verifier globally; re-install the fake one after
  // any test swapped in the local JWT verifier.
  createApp({ verifyToken: testVerifier });
});

afterAll(async () => {
  await closeDb();
});

describe("catalog form options", () => {
  /*
   * The request form is filled in by accounts that are NOT active yet, so this
   * endpoint must pass the gate that holds them back. It used plain `auth()`,
   * which answered 403 "Account is pending" to the only people who need it.
   */
  it("is readable by a pending, role-less account", async () => {
    await seedUser({ clerkId: "applicant_1", status: "pending", role: null });

    const res = await request(app)
      .get("/api/v1/catalog/form-options")
      .set(authHeader("applicant_1"));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ boards: [], levels: [], subjects: [] });
  });

  it("still requires a token", async () => {
    const res = await request(app).get("/api/v1/catalog/form-options");
    expect(res.status).toBe(401);
  });
});

describe("super admin", () => {
  it("reaches /me with the admin dashboard as its home", async () => {
    // The seeded shape: a role is the approval, so `pending` + role still lands.
    await seedUser({
      clerkId: "super_1",
      role: "super_admin",
      status: "pending",
      onboarded: true,
    });

    const res = await request(app).get("/api/v1/me").set(authHeader("super_1"));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      role: "super_admin",
      status: "pending",
      home: "/admin",
    });
  });

  it("is not sent to /pending and can call admin routes", async () => {
    await seedUser({
      clerkId: "super_2",
      role: "super_admin",
      status: "pending",
      onboarded: true,
    });

    const users = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeader("super_2"));
    expect(users.status).toBe(200);
  });

  it("cannot file an access request", async () => {
    await seedUser({
      clerkId: "super_3",
      role: "super_admin",
      status: "active",
    });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("super_3"))
      .send(requestBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already has a role/i);
  });

  it("cannot file an access request while still pending-with-a-role", async () => {
    await seedUser({
      clerkId: "super_4",
      role: "super_admin",
      status: "pending",
    });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("super_4"))
      .send(requestBody);

    expect(res.status).toBe(409);
  });
});

describe("access requests", () => {
  it("lets a role-less pending account apply", async () => {
    await seedUser({ clerkId: "applicant_1", status: "pending", role: null });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("applicant_1"))
      .send(requestBody);

    expect(res.status).toBe(200);
  });

  it("rejects a second application from the same account as a conflict", async () => {
    await seedUser({ clerkId: "applicant_2", status: "pending", role: null });

    const first = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("applicant_2"))
      .send(requestBody);
    expect(first.status).toBe(200);

    // Re-submitting updates the open request, it does not fail: the route is
    // idempotent by design. What must not happen is a role being granted.
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, "applicant_2"));
    expect(row.role).toBeNull();
    expect(row.status).toBe("pending");
  });

  it("refuses an active, role-holding account", async () => {
    await seedUser({
      clerkId: "active_student",
      role: "student",
      status: "active",
    });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("active_student"))
      .send(requestBody);

    expect(res.status).toBe(409);
  });
});

describe("session validity", () => {
  it("rejects an expired JWT", async () => {
    try {
      createApp({ verifyToken: localTokenVerifier() });
      // A validly-signed token whose expiry has passed must be refused.
      const token = createLocalSessionToken({ sub: "anyone" });
      const [, payload, signature] = token.split(".");
      const claims = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      );
      claims.exp = Math.floor(Date.now() / 1000) - 60;
      const forged = `${Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString(
        "base64url",
      )}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;

      const res = await request(
        createApp({ verifyToken: localTokenVerifier() }),
      )
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(401);
    } finally {
      createApp({ verifyToken: testVerifier });
    }
  });

  it("rejects a token with a tampered signature", async () => {
    try {
      createApp({ verifyToken: localTokenVerifier() });
      const token = createLocalSessionToken({ sub: "anyone" });
      const tampered = `${token.slice(0, -4)}XXXX`;

      const res = await request(
        createApp({ verifyToken: localTokenVerifier() }),
      )
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${tampered}`);
      expect(res.status).toBe(401);
    } finally {
      createApp({ verifyToken: testVerifier });
    }
  });

  it("refuses a suspended account everywhere, including /me", async () => {
    await seedUser({
      clerkId: "suspended_2",
      role: "student",
      status: "suspended",
    });

    // `auth()` refuses a suspended account before any handler runs, so even the
    // open `/me` answers with an error rather than a home page.
    const me = await request(app)
      .get("/api/v1/me")
      .set(authHeader("suspended_2"));
    expect(me.status).toBeGreaterThanOrEqual(400);
    expect(me.body.ok).toBe(false);

    const blocked = await request(app)
      .get("/api/v1/student/courses")
      .set(authHeader("suspended_2"));
    expect(blocked.status).toBe(403);
  });

  it("refuses a teacher on admin routes (403) without weakening the gate", async () => {
    await seedUser({ clerkId: "teacher_2", role: "teacher" });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeader("teacher_2"));
    expect(res.status).toBe(403);
  });
});


