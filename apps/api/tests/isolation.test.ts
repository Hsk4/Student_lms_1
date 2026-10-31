import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { closeDb, db } from "@/db";
import {
  assignments,
  boards,
  courses,
  enrollments,
  guardianships,
  invoices,
  levels,
  subjects,
} from "@/db/schema";
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

/** A board, a level, a subject and one active course on them. */
async function seedCatalog() {
  const [board] = await db
    .insert(boards)
    .values({ name: "Sindh", slug: "sindh" })
    .returning();
  const [level] = await db
    .insert(levels)
    .values({ name: "O Level", order: 1 })
    .returning();
  const [subject] = await db
    .insert(subjects)
    .values({ name: "Maths", slug: "maths" })
    .returning();
  return { boardId: board.id, levelId: level.id, subjectId: subject.id };
}

describe("role gates", () => {
  it("blocks a teacher from admin routes (403)", async () => {
    await seedUser({ clerkId: "teacher_1", role: "teacher" });
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeader("teacher_1"));
    expect(res.status).toBe(403);
  });

  it("blocks a pending account from a panel route (403)", async () => {
    await seedUser({
      clerkId: "pending_1",
      status: "pending",
      onboarded: false,
    });
    const res = await request(app)
      .get("/api/v1/teacher/dashboard")
      .set(authHeader("pending_1"));
    expect(res.status).toBe(403);
  });

  it("lets an admin read the users list", async () => {
    await seedUser({ clerkId: "admin_1", role: "admin" });
    await seedUser({ clerkId: "student_1", role: "student" });
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeader("admin_1"));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
  });
});

describe("student isolation", () => {
  it("never returns another student's courses", async () => {
    const catalog = await seedCatalog();
    const course = await db
      .insert(courses)
      .values(catalog)
      .returning();
    const teacher = await seedUser({ clerkId: "teacher_1", role: "teacher" });
    const studentA = await seedUser({ clerkId: "student_a", role: "student" });
    const studentB = await seedUser({ clerkId: "student_b", role: "student" });

    await db.insert(enrollments).values({
      studentId: studentA.id,
      teacherId: teacher.id,
      courseId: course[0].id,
      state: "active",
    });

    const res = await request(app)
      .get("/api/v1/student/courses")
      .set(authHeader("student_b"));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    void studentB;
  });

  it("refuses to submit for an assignment they are not enrolled in (403)", async () => {
    const catalog = await seedCatalog();
    const [course] = await db
      .insert(courses)
      .values(catalog)
      .returning();
    const teacher = await seedUser({ clerkId: "teacher_1", role: "teacher" });
    const other = await seedUser({ clerkId: "student_other", role: "student" });
    await seedUser({ clerkId: "student_a", role: "student" });

    // The assignment belongs to another student's one-on-one enrollment.
    const [theirEnrollment] = await db
      .insert(enrollments)
      .values({
        studentId: other.id,
        teacherId: teacher.id,
        courseId: course.id,
        state: "active",
      })
      .returning();

    const [assignment] = await db
      .insert(assignments)
      .values({
        courseId: course.id,
        teacherId: teacher.id,
        classId: null,
        enrollmentId: theirEnrollment.id,
        title: "Essay",
      })
      .returning();

    const res = await request(app)
      .post("/api/v1/student/submissions")
      .set(authHeader("student_a"))
      .send({ assignmentId: assignment.id, text: "hello" });
    expect(res.status).toBe(403);
  });
});

describe("teacher isolation", () => {
  it("404s when a teacher reads a student who is not theirs", async () => {
    const catalog = await seedCatalog();
    const [course] = await db
      .insert(courses)
      .values(catalog)
      .returning();
    const teacherA = await seedUser({ clerkId: "teacher_a", role: "teacher" });
    await seedUser({ clerkId: "teacher_b", role: "teacher" });
    const student = await seedUser({ clerkId: "student_a", role: "student" });

    await db.insert(enrollments).values({
      studentId: student.id,
      teacherId: teacherA.id,
      courseId: course.id,
      state: "active",
    });

    const mine = await request(app)
      .get(`/api/v1/teacher/students/${student.id}`)
      .set(authHeader("teacher_a"));
    expect(mine.status).toBe(200);

    const theirs = await request(app)
      .get(`/api/v1/teacher/students/${student.id}`)
      .set(authHeader("teacher_b"));
    expect(theirs.status).toBe(403);
  });

  it("refuses to create a class for a course they do not teach (403)", async () => {
    const catalog = await seedCatalog();
    const [course] = await db
      .insert(courses)
      .values(catalog)
      .returning();
    await seedUser({ clerkId: "teacher_a", role: "teacher" });

    const res = await request(app)
      .post("/api/v1/teacher/classes")
      .set(authHeader("teacher_a"))
      .send({ courseId: course.id, name: "Batch A" });
    expect(res.status).toBe(403);
  });
});

describe("parent isolation", () => {
  async function twoFamilies() {
    const studentA = await seedUser({ clerkId: "student_a", role: "student" });
    const studentB = await seedUser({ clerkId: "student_b", role: "student" });
    await seedUser({ clerkId: "parent_a", role: "parent" });
    const parentA = await seedUser({ clerkId: "parent_a2", role: "parent" });
    await db
      .insert(guardianships)
      .values({ parentId: parentA.id, studentId: studentA.id });
    return { studentA, studentB, parentA };
  }

  it("404s on a child that is not linked", async () => {
    const { studentB } = await twoFamilies();
    const res = await request(app)
      .get(`/api/v1/parent/children/${studentB.id}`)
      .set(authHeader("parent_a2"));
    expect(res.status).toBe(404);
  });

  it("403s on another family's invoice", async () => {
    const { studentB } = await twoFamilies();
    const res = await request(app)
      .get(`/api/v1/invoices?studentId=${studentB.id}`)
      .set(authHeader("parent_a2"));
    expect(res.status).toBe(403);
  });

  it("403s when a parent requests a meeting for an unlinked child", async () => {
    const { studentB } = await twoFamilies();
    const res = await request(app)
      .post("/api/v1/parent/meetings")
      .set(authHeader("parent_a2"))
      .send({ studentId: studentB.id, preferredDay: "Monday" });
    expect(res.status).toBe(403);
  });

  it("lets a parent read their own child's invoices", async () => {
    const { studentA } = await twoFamilies();
    await db.insert(invoices).values({
      studentId: studentA.id,
      period: "2026-11",
      amount: "5000.00",
      dueDate: new Date("2026-11-05T00:00:00Z"),
    });
    const res = await request(app)
      .get(`/api/v1/invoices?studentId=${studentA.id}`)
      .set(authHeader("parent_a2"));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(5000);
  });
});
