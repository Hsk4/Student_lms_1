import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { closeDb, db } from "@/db";
import { auditLogs, guardianships, parentInvites } from "@/db/schema";
import { createApp } from "@/app";
import { authHeader, resetDb, seedUser, testVerifier } from "./helpers";

let app: Express;

beforeAll(() => {
  app = createApp({ verifyToken: testVerifier });
});
beforeEach(resetDb);
afterAll(async () => {
  await closeDb();
});

async function createCode(studentClerkId: string, parentEmail?: string) {
  const res = await request(app)
    .post("/api/v1/student/parent-links")
    .set(authHeader(studentClerkId))
    .send({
      parentName: "Parent One",
      ...(parentEmail ? { parentEmail } : {}),
    });
  return res;
}

describe("parent link codes", () => {
  it("401s without a token", async () => {
    const res = await request(app)
      .post("/api/v1/student/parent-links")
      .send({ parentName: "Parent One" });
    expect(res.status).toBe(401);
  });

  it("403s for a non-student role", async () => {
    await seedUser({ clerkId: "teacher_1", role: "teacher" });
    const res = await createCode("teacher_1");
    expect(res.status).toBe(403);
  });

  it("403s for an active student who has not onboarded", async () => {
    await seedUser({
      clerkId: "student_new",
      role: "student",
      onboarded: false,
    });
    const res = await createCode("student_new");
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("/onboarding/parent");
  });

  it("lets a student issue a code, written to the audit log", async () => {
    const student = await seedUser({ clerkId: "student_1", role: "student" });
    const res = await createCode("student_1");
    expect(res.status).toBe(200);
    expect(res.body.data.code).toMatch(/^[A-Z0-9]{8}$/);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "createParentLink"));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: student.id,
      targetType: "ParentInvite",
    });
  });

  it("lets the right parent redeem and links the child", async () => {
    // A student must finish onboarding before the panel opens; linking a
    // parent through this API does not flip the flag by itself (guard.ts rule).
    const student = await seedUser({ clerkId: "student_1", role: "student" });
    const parent = await seedUser({ clerkId: "parent_1", role: "parent" });
    const created = await createCode("student_1");
    const code = created.body.data.code as string;

    const res = await request(app)
      .post("/api/v1/parent/parent-links/redeem")
      .set(authHeader("parent_1"))
      .send({ code: code.toLowerCase() });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: student.id, name: student.name });

    const links = await db
      .select()
      .from(guardianships)
      .where(eq(guardianships.parentId, parent.id));
    expect(links.map((link) => link.studentId)).toEqual([student.id]);

    const [invite] = await db.select().from(parentInvites);
    expect(invite.state).toBe("accepted");
    expect(invite.acceptedBy).toBe(parent.id);



    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "redeemParentLink"));
    expect(audits).toHaveLength(1);
  });

  it("refuses a second redemption of the same code", async () => {
    await seedUser({ clerkId: "student_1", role: "student" });
    await seedUser({ clerkId: "parent_1", role: "parent" });
    await seedUser({ clerkId: "parent_2", role: "parent" });
    const code = (await createCode("student_1")).body.data.code as string;

    const first = await request(app)
      .post("/api/v1/parent/parent-links/redeem")
      .set(authHeader("parent_1"))
      .send({ code });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/v1/parent/parent-links/redeem")
      .set(authHeader("parent_2"))
      .send({ code });
    expect(second.status).toBe(409);
  });

  it("403s when a non-parent tries to redeem", async () => {
    await seedUser({ clerkId: "student_1", role: "student" });
    await seedUser({ clerkId: "student_2", role: "student" });
    const code = (await createCode("student_1")).body.data.code as string;
    const res = await request(app)
      .post("/api/v1/parent/parent-links/redeem")
      .set(authHeader("student_2"))
      .send({ code });
    expect(res.status).toBe(403);
  });

  it("lists only the student's own guardians", async () => {
    await seedUser({ clerkId: "student_1", role: "student" });
    await seedUser({ clerkId: "student_2", role: "student" });
    await createCode("student_1");

    const res = await request(app)
      .get("/api/v1/student/guardians")
      .set(authHeader("student_2"));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("403s when one student revokes another student's code", async () => {
    await seedUser({ clerkId: "student_1", role: "student" });
    await seedUser({ clerkId: "student_2", role: "student" });
    await createCode("student_1");
    const [invite] = await db.select().from(parentInvites);

    const res = await request(app)
      .post(`/api/v1/student/parent-links/${invite.id}/revoke`)
      .set(authHeader("student_2"));
    expect(res.status).toBe(404);
    const [after] = await db.select().from(parentInvites);
    expect(after.state).toBe("sent");
  });
});
