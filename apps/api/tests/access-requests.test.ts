import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "@/app";
import { closeDb, db } from "@/db";
import { accessRequests, levels, subjects, users } from "@/db/schema";
import { authHeader, resetDb, seedUser, testVerifier } from "./helpers";

/**
 * Role-specific access requests: a teacher application carries the teaching
 * profile, a parent application carries the guardian/student details, and the
 * API and the admin panel both keep the two apart.
 */

const app = createApp({ verifyToken: testVerifier });

async function seedCatalog() {
  const [maths] = await db
    .insert(subjects)
    .values({ name: "Mathematics", slug: "mathematics", active: true })
    .returning();
  const [physics] = await db
    .insert(subjects)
    .values({ name: "Physics", slug: "physics", active: true })
    .returning();
  const [secondary] = await db
    .insert(levels)
    .values({ name: "Secondary", order: 2 })
    .returning();
  const [senior] = await db
    .insert(levels)
    .values({ name: "Senior", order: 3 })
    .returning();
  return { maths, physics, secondary, senior };
}

const teacherBody = (subjectIds: string[], levelIds: string[]) => ({
  requestedRole: "teacher",
  name: "Ali Khan",
  email: "ali@school.test",
  phone: "0300-1234567",
  application: {
    subjects: subjectIds,
    gradeLevels: levelIds,
    experienceYears: 5,
    previousInstitution: "City School",
    qualifications: "MSc Mathematics",
    certifications: "B.Ed",
    experience: "Five years teaching O-level maths.",
    motivation: "I want to teach here.",
    availability: "Mon–Thu evenings",
    bio: "Maths teacher.",
    additionalInformation: "",
  },
});

const parentBody = {
  requestedRole: "parent",
  name: "Sara Ahmed",
  email: "sara@school.test",
  phone: "0300-7654321",
  application: {
    relationship: "mother",
    studentName: "Hina Ahmed",
    studentKey: "hina@school.test",
    studentEmail: "hina@school.test",
    motivation: "I want to follow my daughter's progress.",
    additionalInformation: "",
  },
};

beforeEach(async () => {
  await resetDb();
  createApp({ verifyToken: testVerifier });
});

afterAll(async () => {
  await closeDb();
});

describe("teacher requests", () => {
  it("stores the teaching profile and the role", async () => {
    const { maths, physics, secondary } = await seedCatalog();
    await seedUser({
      clerkId: "teacher_applicant",
      status: "pending",
      role: null,
    });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("teacher_applicant"))
      .send(teacherBody([maths.id, physics.id], [secondary.id]));

    expect(res.status).toBe(200);

    const [row] = await db.select().from(accessRequests);
    expect(row.requestedRole).toBe("teacher");
    expect(row.state).toBe("open");
    expect(row.phone).toBe("0300-1234567");
    expect(row.applicationData?.teacher).toMatchObject({
      experienceYears: 5,
      qualifications: "MSc Mathematics",
      experience: "Five years teaching O-level maths.",
      motivation: "I want to teach here.",
      availability: "Mon–Thu evenings",
      subjects: [maths.id, physics.id],
      gradeLevels: [secondary.id],
    });
    expect(row.applicationData?.parent).toBeNull();
    expect(row.teacherGradeLevelIds).toEqual([secondary.id]);

    // No password or credential ever lands in the application.
    expect(JSON.stringify(row.applicationData)).not.toMatch(/password/i);
  });

  it("rejects a teacher application with no subjects", async () => {
    const { secondary } = await seedCatalog();
    await seedUser({ clerkId: "teacher_bad", status: "pending", role: null });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("teacher_bad"))
      .send(teacherBody([], [secondary.id]));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject/i);
  });

  it("rejects a teacher application with no experience description", async () => {
    const { maths, secondary } = await seedCatalog();
    await seedUser({ clerkId: "teacher_bad2", status: "pending", role: null });

    const body = teacherBody([maths.id], [secondary.id]);
    body.application.experience = "";

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("teacher_bad2"))
      .send(body);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error)).toMatch(/teaching experience/i);
  });

  it("rejects a negative number of years", async () => {
    const { maths, secondary } = await seedCatalog();
    await seedUser({ clerkId: "teacher_bad3", status: "pending", role: null });

    const body = teacherBody([maths.id], [secondary.id]);
    body.application.experienceYears = -1;

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("teacher_bad3"))
      .send(body);

    expect(res.status).toBe(400);
  });
});

describe("parent requests", () => {
  it("stores the guardian/student details and the role", async () => {
    await seedUser({
      clerkId: "parent_applicant",
      status: "pending",
      role: null,
    });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("parent_applicant"))
      .send(parentBody);

    expect(res.status).toBe(200);

    const [row] = await db.select().from(accessRequests);
    expect(row.requestedRole).toBe("parent");
    expect(row.applicationData?.parent).toMatchObject({
      relationship: "mother",
      studentName: "Hina Ahmed",
      studentKey: "hina@school.test",
      motivation: "I want to follow my daughter's progress.",
    });
    expect(row.applicationData?.teacher).toBeNull();
  });

  it("rejects a parent application with no relationship", async () => {
    await seedUser({ clerkId: "parent_bad", status: "pending", role: null });

    const body = structuredClone(parentBody) as Record<string, unknown>;
    delete (body.application as Record<string, unknown>).relationship;

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("parent_bad"))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/relationship/i);
  });

  it("rejects a parent application with no reason for access", async () => {
    await seedUser({ clerkId: "parent_bad2", status: "pending", role: null });

    const body = structuredClone(parentBody) as {
      application: { motivation: string };
    };
    body.application.motivation = "";

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("parent_bad2"))
      .send(body);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error)).toMatch(/why you need parent access/i);
  });

  it("rejects an unknown role", async () => {
    await seedUser({ clerkId: "weird", status: "pending", role: null });

    const res = await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("weird"))
      .send({ ...parentBody, requestedRole: "super_admin" });

    expect(res.status).toBe(400);
  });

  it("keeps the one-click parent request working (legacy body)", async () => {
    await seedUser({ clerkId: "one_click", status: "pending", role: null });

    const res = await request(app)
      .post("/api/v1/me/request/parent")
      .set(authHeader("one_click"));

    expect(res.status).toBe(200);
    const [row] = await db.select().from(accessRequests);
    expect(row.requestedRole).toBe("parent");
    expect(row.applicationData).toBeNull();
  });
});

describe("admin review", () => {
  it("lists requests with their type and structured application", async () => {
    const { maths, secondary } = await seedCatalog();
    await seedUser({ clerkId: "t_app", status: "pending", role: null });
    await seedUser({ clerkId: "p_app", status: "pending", role: null });
    await seedUser({ clerkId: "admin_1", role: "admin", status: "active" });

    await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("t_app"))
      .send(teacherBody([maths.id], [secondary.id]));
    await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("p_app"))
      .send(parentBody);

    const res = await request(app)
      .get("/api/v1/admin/requests")
      .set(authHeader("admin_1"));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const teacher = res.body.data.find(
      (r: { requestedRole: string }) => r.requestedRole === "teacher",
    );
    expect(teacher.application.teacher.experienceYears).toBe(5);
    expect(teacher.subjectLabels).toEqual(["Mathematics"]);
    expect(teacher.levelLabels).toEqual(["Secondary"]);

    const parent = res.body.data.find(
      (r: { requestedRole: string }) => r.requestedRole === "parent",
    );
    expect(parent.application.parent.studentName).toBe("Hina Ahmed");
  });

  it("filters by type", async () => {
    await seedUser({ clerkId: "p_only", status: "pending", role: null });
    await seedUser({ clerkId: "admin_2", role: "admin", status: "active" });
    await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("p_only"))
      .send(parentBody);

    const teachers = await request(app)
      .get("/api/v1/admin/requests?role=teacher")
      .set(authHeader("admin_2"));
    expect(teachers.status).toBe(200);
    expect(teachers.body.data).toHaveLength(0);

    const parents = await request(app)
      .get("/api/v1/admin/requests?role=parent")
      .set(authHeader("admin_2"));
    expect(parents.body.data).toHaveLength(1);
  });

  it("returns one request in full, and 404s for an unknown id", async () => {
    const { maths, secondary } = await seedCatalog();
    await seedUser({ clerkId: "t_full", status: "pending", role: null });
    await seedUser({ clerkId: "admin_3", role: "admin", status: "active" });
    await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("t_full"))
      .send(teacherBody([maths.id], [secondary.id]));

    const [row] = await db.select().from(accessRequests);
    const res = await request(app)
      .get(`/api/v1/admin/requests/${row.id}`)
      .set(authHeader("admin_3"));
    expect(res.status).toBe(200);
    expect(res.body.data.application.teacher.availability).toBe(
      "Mon–Thu evenings",
    );

    const missing = await request(app)
      .get("/api/v1/admin/requests/00000000-0000-4000-8000-000000000000")
      .set(authHeader("admin_3"));
    expect(missing.status).toBe(404);
  });

  it("does not expose requests to non-admins", async () => {
    const someone = await seedUser({ clerkId: "someone" });
    const [row] = await db
      .insert(accessRequests)
      .values({
        userId: someone.id,
        name: "X",
        email: "x@y.z",
      })
      .returning();

    for (const clerkId of ["someone"]) {
      const list = await request(app)
        .get("/api/v1/admin/requests")
        .set(authHeader(clerkId));
      expect(list.status).toBe(403);
      const one = await request(app)
        .get(`/api/v1/admin/requests/${row.id}`)
        .set(authHeader(clerkId));
      expect(one.status).toBe(403);
    }
  });

  it("approving still assigns the role and closes the request", async () => {
    await seedUser({ clerkId: "p_approve", status: "pending", role: null });
    const admin = await seedUser({
      clerkId: "admin_4",
      role: "admin",
      status: "active",
    });
    await request(app)
      .post("/api/v1/me/request")
      .set(authHeader("p_approve"))
      .send(parentBody);

    const [row] = await db.select().from(accessRequests);
    const res = await request(app)
      .post(`/api/v1/admin/requests/${row.id}/decision`)
      .set(authHeader("admin_4"))
      .send({ decision: "approve", role: "parent" });
    expect(res.status).toBe(200);

    const [after] = await db.select().from(accessRequests);
    expect(after.state).toBe("approved");
    expect(after.decidedBy).toBe(admin.id);

    const [account] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, "p_approve"));
    expect(account.role).toBe("parent");
    expect(account.status).toBe("active");
  });
});

describe("legacy requests", () => {
  it("still lists and reads a request filed before the split", async () => {
    /*
     * The shape every pre-existing row has: a role and a note, no structured
     * application. The admin panel must render it, not crash on it.
     */
    const oldUser = await seedUser({
      clerkId: "legacy_applicant",
      status: "pending",
      role: null,
    });
    const [row] = await db
      .insert(accessRequests)
      .values({
        userId: oldUser.id,
        name: "Old Applicant",
        email: "old@school.test",
        requestedRole: "student",
        note: "I am a student and want to join.",
      })
      .returning();
    await seedUser({ clerkId: "admin_5", role: "admin", status: "active" });

    const list = await request(app)
      .get("/api/v1/admin/requests")
      .set(authHeader("admin_5"));
    expect(list.status).toBe(200);
    const legacy = list.body.data.find((r: { id: string }) => r.id === row.id);
    expect(legacy.requestedRole).toBe("student");
    expect(legacy.application).toEqual({ teacher: null, parent: null });
    expect(legacy.note).toBe("I am a student and want to join.");

    const detail = await request(app)
      .get(`/api/v1/admin/requests/${row.id}`)
      .set(authHeader("admin_5"));
    expect(detail.status).toBe(200);
    expect(detail.body.data.application).toEqual({
      teacher: null,
      parent: null,
    });
  });
});
