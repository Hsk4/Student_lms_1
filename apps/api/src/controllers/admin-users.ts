import type { Request } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  assignRoleSchema,
  recordIdSchema,
  type AdminRequestView,
  rejectUserSchema,
  requestDecisionSchema,
  userActionSchema,
  type GateUser,
  type UserRole,
  type UserStatus,
} from "@lms/shared";
import { db } from "@/db";
import { accessRequests } from "@/db/schema";
import { conflict, forbidden, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import { findRequestById } from "@/db/queries/access-requests";
import { findCourseById } from "@/db/queries/courses";
import { findActiveCourseIds } from "@/db/queries/courses";
import {
  linkParentToStudent,
  unlinkParentFromStudent,
} from "@/db/queries/guardianships";
import { parentInvites } from "@/db/schema";
import { findInviteById } from "@/db/queries/parent-invites";
import {
  listCourseIdsForTeacher,
  replaceTeacherCourses,
} from "@/db/queries/teacher-courses";
import { findUserById, updateUser } from "@/db/queries/users";
import { LINK_CODE_TTL_DAYS, uniqueLinkCode } from "@/lib/link-codes";
import {
  countOpenRequests,
  listAccessRequests,
} from "@/db/queries/access-requests";
import {
  countBooksByCourse,
  listBooks,
  findBookById,
} from "@/db/queries/books";
import { listAuditLogs } from "@/db/queries/audit-logs";
import { listInvitesWithStudent } from "@/db/queries/parent-invites";
import {
  countUsers,
  listAllUsers,
  listUsersByIds,
  listUsersByRole,
  listUsersByStatus,
} from "@/db/queries/users";
import { listBoards } from "@/db/queries/boards";
import { listLevels } from "@/db/queries/levels";
import { listSubjects } from "@/db/queries/subjects";
import { listCoursesView } from "@/controllers/catalog";

/**
 * Admin user management: assign a role, reject, suspend, reinstate, decide a
 * request, and the guardian/link-code repair tools.
 *
 * Postgres is the only authority. A role change is one transaction: the user
 * row, the access request and the audit entry commit together or not at all,
 * and `sessionVersion` is bumped so tokens minted before the change stop
 * working.
 */

function canManage(
  actorRole: "super_admin" | "admin",
  targetRole: string | null,
) {
  if (targetRole === "super_admin") return false;
  if (targetRole === "admin") return actorRole === "super_admin";
  return true;
}

function actorAdmin(
  req: Request,
): GateUser & { role: "admin" | "super_admin" } {
  const actor = actorOf(req);
  if (actor.role !== "admin" && actor.role !== "super_admin") throw forbidden();
  return actor as GateUser & { role: "admin" | "super_admin" };
}

export async function assignRole(req: Request) {
  const actor = actorAdmin(req);
  const input = assignRoleSchema.parse({ ...req.body, userId: req.params.id });
  /*
   * Courses are only meaningful for a teacher. They arrive from the request
   * decision ("approve as teacher, and these are their classes") so the office
   * can do the whole job in one click instead of approving and then hunting for
   * the user again to assign courses.
   */
  const courseIds =
    input.role === "teacher" ? await validatedCourseIds(req.body?.courseIds) : [];

  const before: Record<string, unknown> = {};
  await db.transaction(async (tx) => {
    const user = await findUserById(input.userId, tx);
    if (!user) throw notFound("User not found");
    if (!canManage(actor.role, user.role))
      throw forbidden("You cannot change this user");

    Object.assign(before, {
      role: user.role,
      status: user.status,
      rejectedAt: user.rejectedAt,
      rejectionReason: user.rejectionReason,
    });

    await updateUser(
      user.id,
      {
        role: input.role as UserRole,
        status: "active",
        rejectedAt: null,
        rejectionReason: null,
      },
      tx,
    );
    await tx
      .update(accessRequests)
      .set({ state: "approved", decidedBy: actor.id, decidedAt: new Date() })
      .where(eq(accessRequests.userId, user.id));

    // Same transaction as the role: a teacher is never activated without the
    // classes the admin picked, and a failed course write rolls the role back.
    if (courseIds.length) {
      await replaceTeacherCourses(user.id, courseIds, tx);
    }

    await writeAudit(
      {
        actorId: actor.id,
        action: "assignRole",
        targetType: "User",
        targetId: user.id,
        before,
        after: {
          role: input.role,
          status: "active",
          ...(courseIds.length ? { courseIds } : {}),
        },
      },
      { tx },
    );
  });
}

/**
 * Normalise and check the course ids an approval carries.
 *
 * Absent means "no courses yet", which is allowed. Present but wrong (unknown
 * or inactive) is a conflict, so the admin sees why instead of silently getting
 * a teacher with no classes.
 */
async function validatedCourseIds(raw: unknown): Promise<string[]> {
  const parsed = z.array(recordIdSchema).max(100).safeParse(raw ?? []);
  if (!parsed.success) throw conflict("One or more courses are not valid");
  const unique = [...new Set(parsed.data)];
  if (unique.length === 0) return [];
  const active = await findActiveCourseIds(unique);
  if (active.length !== unique.length) {
    throw conflict("One or more courses are missing or inactive");
  }
  return unique;
}

export async function rejectUser(req: Request) {
  const actor = actorAdmin(req);
  const input = rejectUserSchema.parse({ ...req.body, userId: req.params.id });

  const before: Record<string, unknown> = {};
  await db.transaction(async (tx) => {
    const user = await findUserById(input.userId, tx);
    if (!user) throw notFound("User not found");
    if (!canManage(actor.role, user.role))
      throw forbidden("You cannot change this user");

    Object.assign(before, {
      status: user.status,
      rejectedAt: user.rejectedAt,
      rejectionReason: user.rejectionReason,
    });

    await updateUser(
      user.id,
      {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      },
      tx,
    );
    await tx
      .update(accessRequests)
      .set({
        state: "rejected",
        decidedBy: actor.id,
        decidedAt: new Date(),
        reason: input.reason,
      })
      .where(eq(accessRequests.userId, user.id));
    await writeAudit(
      {
        actorId: actor.id,
        action: "rejectUser",
        targetType: "User",
        targetId: user.id,
        before,
        after: { status: "rejected", reason: input.reason },
      },
      { tx },
    );
  });
}

/* suspend / reinstate */

async function setStatus(
  req: Request,
  target: "suspended" | "active",
  action: "suspendUser" | "reinstateUser",
) {
  const actor = actorAdmin(req);
  const input = userActionSchema.parse({ userId: req.params.id });

  let beforeStatus: UserStatus = "active";
  await db.transaction(async (tx) => {
    const user = await findUserById(input.userId, tx);
    if (!user) throw notFound("User not found");
    if (!canManage(actor.role, user.role))
      throw forbidden("You cannot change this user");
    if (target === "active" && !user.role) {
      throw conflict("Assign a role before reinstating this user");
    }

    beforeStatus = user.status;
    await updateUser(user.id, { status: target }, tx);
    await writeAudit(
      {
        actorId: actor.id,
        action,
        targetType: "User",
        targetId: user.id,
        before: { status: beforeStatus },
        after: { status: target },
      },
      { tx },
    );
  });
}

export const suspendUser = (req: Request) =>
  setStatus(req, "suspended", "suspendUser");
export const reinstateUser = (req: Request) =>
  setStatus(req, "active", "reinstateUser");

export async function decideAccessRequest(req: Request) {
  const actorAdminCheck = actorAdmin(req);
  void actorAdminCheck;
  const input = requestDecisionSchema.parse({
    ...req.body,
    requestId: req.params.id,
  });

  const request = await findRequestById(input.requestId);
  if (!request || request.state !== "open")
    throw notFound("Open request not found");
  if (input.decision === "approve") {
    if (!input.role) throw conflict("Pick a role to approve this request");
    req.body = { role: input.role, courseIds: input.courseIds };
    req.params = { ...req.params, id: request.userId };
    return assignRole(req);
  }
  if (!input.reason) throw conflict("Give a reason for rejecting");
  req.body = { reason: input.reason };
  req.params = { ...req.params, id: request.userId };
  return rejectUser(req);
}



/* Guardian repair + link codes */

const guardianSchema = z.object({
  parentId: recordIdSchema,
  studentId: recordIdSchema,
});

export async function linkGuardian(req: Request) {
  const actor = actorAdmin(req);
  const input = guardianSchema.parse(req.body);

  const [parent, student] = await Promise.all([
    findUserById(input.parentId),
    findUserById(input.studentId),
  ]);
  if (!parent || parent.role !== "parent")
    throw notFound("Parent account not found");
  if (!student || student.role !== "student")
    throw notFound("Student account not found");

  await db.transaction(async (tx) => {
    await linkParentToStudent(
      parent.id,
      student.id,
      { markOnboarded: true },
      tx,
    );
    await tx
      .update(parentInvites)
      .set({ state: "accepted", acceptedBy: parent.id, acceptedAt: new Date() })
      .where(
        and(
          eq(parentInvites.studentId, student.id),
          eq(parentInvites.parentEmail, parent.email),
        ),
      );
    await writeAudit(
      {
        actorId: actor.id,
        action: "linkGuardian",
        targetType: "User",
        targetId: student.id,
        after: { parentId: parent.id, studentId: student.id },
      },
      { tx },
    );
  });
}

export async function unlinkGuardian(req: Request) {
  const actor = actorAdmin(req);
  const input = guardianSchema.parse(req.body);

  await db.transaction(async (tx) => {
    await unlinkParentFromStudent(input.parentId, input.studentId, tx);
    await writeAudit(
      {
        actorId: actor.id,
        action: "unlinkGuardian",
        targetType: "User",
        targetId: input.studentId,
        before: { parentId: input.parentId, studentId: input.studentId },
      },
      { tx },
    );
  });
}

export async function revokeParentInvite(req: Request) {
  const actor = actorAdmin(req);
  const inviteId = String(req.params.id);

  await db.transaction(async (tx) => {
    const invite = await findInviteById(inviteId, tx);
    if (!invite) throw notFound("Invite not found");
    if (invite.state === "revoked") throw conflict("Invite already revoked");
    if (invite.state === "accepted")
      throw conflict("Cannot revoke an accepted invite");

    await tx
      .update(parentInvites)
      .set({ state: "revoked" })
      .where(eq(parentInvites.id, invite.id));
    await writeAudit(
      {
        actorId: actor.id,
        action: "revokeParentInvite",
        targetType: "ParentInvite",
        targetId: invite.id,
        before: { state: invite.state },
        after: { state: "revoked" },
      },
      { tx },
    );
  });
}

export async function reissueParentInvite(req: Request) {
  const actor = actorAdmin(req);
  const inviteId = String(req.params.id);
  const code = await uniqueLinkCode();
  const expiresAt = new Date(
    Date.now() + LINK_CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    const invite = await findInviteById(inviteId, tx);
    if (!invite) throw notFound("Invite not found");
    if (invite.state === "accepted")
      throw conflict("This guardian is already linked");

    await tx
      .update(parentInvites)
      .set({ code, state: "sent", expiresAt, attempts: 0 })
      .where(eq(parentInvites.id, invite.id));
    await writeAudit(
      {
        actorId: actor.id,
        action: "reissueParentInvite",
        targetType: "ParentInvite",
        targetId: invite.id,
        before: { code: invite.code, state: invite.state },
        after: { code, expiresAt: expiresAt.toISOString() },
      },
      { tx },
    );
  });

  return { code };
}

/** Admin assigns courses to a teacher, audited in the same transaction. */
const teacherCoursesSchema = z.object({
  courseIds: z.array(recordIdSchema).max(100),
});

export async function setTeacherCourses(req: Request) {
  const actor = actorAdmin(req);
  const input = teacherCoursesSchema.parse(req.body);

  await db.transaction(async (tx) => {
    const teacher = await findUserById(String(req.params.id), tx);
    if (!teacher || teacher.role !== "teacher")
      throw notFound("Teacher not found");

    const unique = [...new Set(input.courseIds)];
    const active = await findActiveCourseIds(unique, tx);
    if (active.length !== unique.length) {
      throw conflict("One or more courses are missing or inactive");
    }

    const before = await listCourseIdsForTeacher(teacher.id, tx);
    await replaceTeacherCourses(teacher.id, unique, tx);
    await writeAudit(
      {
        actorId: actor.id,
        action: "setTeacherCourses",
        targetType: "User",
        targetId: teacher.id,
        before: { courseIds: before },
        after: { courseIds: unique },
      },
      { tx },
    );
  });
}

/* Admin reads */

export async function listRequests(req: Request) {
  const query = z
    .object({
      state: z.enum(["open", "approved", "rejected"]).default("open"),
      /** Optional narrowing, applied here because the list is capped at 200. */
      role: z.enum(["teacher", "parent", "student", "none"]).optional(),
    })
    .parse(req.query);
  const requests = await listAccessRequests(query.state);
  if (requests.length === 0) return [];

  const [users, boards, levels, subjects] = await Promise.all([
    listUsersByIds([...new Set(requests.map((r) => r.userId))]),
    listBoards(),
    listLevels(),
    listSubjects(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const boardName = new Map(boards.map((b) => [b.id, b.name]));
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const decidedById = new Map(
    (
      await listUsersByIds([
        ...new Set(
          requests
            .map((r) => r.decidedBy)
            .filter((id): id is string => Boolean(id)),
        ),
      ])
    ).map((u) => [u.id, u.name]),
  );

  const rows = requests.map((request): AdminRequestView => {
    const user = userById.get(request.userId);
    const teacher = request.application?.teacher ?? null;
    const parent = request.application?.parent ?? null;
    /*
     * The structured half already carries the ids it was filed with; legacy
     * rows fall back to the subject and level link tables.
     */
    const subjectIds = teacher ? teacher.subjects : request.subjectIds;
    const gradeLevelIds = teacher
      ? teacher.gradeLevels
      : request.levelId
        ? [request.levelId]
        : [];
    return {
      id: request.id,
      userId: request.userId,
      name: request.name,
      email: request.email,
      phone: request.phone ?? null,
      note: request.note ?? undefined,
      state: request.state,
      createdAt: request.createdAt.toISOString(),
      board: request.boardId ? boardName.get(request.boardId) : undefined,
      level: request.levelId ? levelName.get(request.levelId) : undefined,
      subjects: subjectIds
        .map((id) => subjectName.get(id) ?? "-")
        .join(", "),
      subjectLabels: subjectIds.map((id) => subjectName.get(id) ?? "-"),
      levelLabels: gradeLevelIds.map((id) => levelName.get(id) ?? "-"),
      // The ids behind `subjects`, so the approval screen can pre-tick the
      // matching courses instead of matching on display names.
      subjectIds,
      userStatus: user?.status ?? "unknown",
      userRole: user?.role ?? null,
      requestedRole: request.requestedRole,
      application: {
        teacher,
        parent,
      },
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decidedBy: request.decidedBy
        ? (decidedById.get(request.decidedBy) ?? "another admin")
        : null,
      decisionReason: request.reason,
    };
  });

  if (!query.role) return rows;
  /*
   * "none" is the legacy queue: requests filed before the role was recorded.
   * They are shown, never hidden — an old application still needs a decision.
   */
  return rows.filter((row) =>
    query.role === "none" ? !row.requestedRole : row.requestedRole === query.role,
  );
}

/** `GET /api/v1/admin/requests/:id` — one application, in full. */
export async function getRequest(req: Request) {
  actorAdmin(req);
  const id = recordIdSchema.parse(req.params.id);
  const request = await findRequestById(id);
  if (!request) throw notFound("Request not found");

  const [user, boards, levels, subjects, decidedBy] = await Promise.all([
    findUserById(request.userId),
    listBoards(),
    listLevels(),
    listSubjects(),
    request.decidedBy ? findUserById(request.decidedBy) : Promise.resolve(null),
  ]);
  const boardName = new Map(boards.map((b) => [b.id, b.name]));
  const levelName = new Map(levels.map((l) => [l.id, l.name]));
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const teacher = request.application?.teacher ?? null;
  const parent = request.application?.parent ?? null;
  const subjectIds = teacher ? teacher.subjects : request.subjectIds;
  const gradeLevelIds = teacher
    ? teacher.gradeLevels
    : request.levelId
      ? [request.levelId]
      : [];

  const view: AdminRequestView = {
    id: request.id,
    userId: request.userId,
    name: request.name,
    email: request.email,
    phone: request.phone,
    note: request.note ?? undefined,
    state: request.state,
    createdAt: request.createdAt.toISOString(),
    board: request.boardId ? boardName.get(request.boardId) : undefined,
    level: request.levelId ? levelName.get(request.levelId) : undefined,
    subjects: subjectIds.map((id) => subjectName.get(id) ?? "-").join(", "),
    subjectLabels: subjectIds.map((id) => subjectName.get(id) ?? "-"),
    levelLabels: gradeLevelIds.map((id) => levelName.get(id) ?? "-"),
    subjectIds,
    userStatus: user?.status ?? "unknown",
    userRole: user?.role ?? null,
    requestedRole: request.requestedRole,
    application: { teacher, parent },
    decidedAt: request.decidedAt?.toISOString() ?? null,
    decidedBy: decidedBy?.name ?? null,
    decisionReason: request.reason,
  };
  return view;
}

export async function pendingCount() {
  return { count: await countOpenRequests() };
}

export async function listUsersAdmin(req: Request) {
  const query = z
    .object({
      status: z.string().optional(),
      role: z.string().optional(),
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(25),
    })
    .parse(req.query);

  const filter = { status: query.status, role: query.role, q: query.q };
  const [found, total, boards, levels, all, active, pending, teachers] =
    await Promise.all([
      listAllUsers(filter),
      countUsers(filter),
      listBoards(),
      listLevels(),
      countUsers(),
      countUsers({ status: "active" }),
      countUsers({ status: "pending" }),
      countUsers({ role: "teacher" }),
    ]);
  const boardName = new Map(boards.map((b) => [b.id, b.name]));
  const levelName = new Map(levels.map((l) => [l.id, l.name]));

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);

  return {
    total,
    page,
    pageCount,
    counts: { all, active, pending, teachers },
    users: found
      .slice((page - 1) * query.pageSize, page * query.pageSize)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        onboarded: user.onboarded,
        createdAt: user.createdAt.toISOString(),
        board: user.student.boardId
          ? boardName.get(user.student.boardId)
          : undefined,
        level: user.student.levelId
          ? levelName.get(user.student.levelId)
          : undefined,
        rejectionReason: user.rejectionReason ?? undefined,
      })),
  };
}

/** `GET /api/v1/admin/users/:id` — the detail page's account card. */
export async function getUserDetail(req: Request) {
  const user = await findUserById(String(req.params.id));
  if (!user) throw notFound("User not found");
  return {
    id: user.id,
    clerkId: user.clerkId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    onboarded: user.onboarded,
    createdAt: user.createdAt.toISOString(),
    rejectedAt: user.rejectedAt ? user.rejectedAt.toISOString() : null,
    rejectionReason: user.rejectionReason ?? null,
  };
}

export async function pendingUsers() {
  return listUsersByStatus("pending");
}

export async function listAuditLog() {
  const entries = await listAuditLogs();
  const actors = await listUsersByIds([
    ...new Set(entries.map((e) => e.actorId)),
  ]);
  const byId = new Map(
    actors.map((a) => [a.id, { name: a.name, email: a.email }]),
  );
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    actor: byId.get(entry.actorId),
    before: entry.before,
    after: entry.after,
    at: entry.at.toISOString(),
  }));
}

export async function listParentLinks() {
  return listInvitesWithStudent();
}

/** `GET /api/v1/admin/parent-links/options` — active parents and students for the repair form. */
export async function parentLinkOptions() {
  const [parents, students] = await Promise.all([
    listUsersByRole("parent", { status: "active" }),
    listUsersByRole("student", { status: "active" }),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const toOption = (user: { id: string; name: string; email: string }) => ({
    id: user.id,
    label: `${user.name} (${user.email})`,
  });
  return {
    parents: [...parents].sort(byName).map(toOption),
    students: [...students].sort(byName).map(toOption),
  };
}

export async function listBooksAdmin() {
  const [books, courses] = await Promise.all([listBooks(), listCoursesView()]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    note: book.note ?? "",
    courseIds: book.courseIds,
    courses: book.courseIds
      .map((id) => byId.get(id)?.label)
      .filter((label): label is string => Boolean(label)),
  }));
}

export async function getBookDetail(req: Request) {
  const book = await findBookById(String(req.params.id));
  if (!book) throw notFound("Book not found");
  const courses = await listCoursesView();
  const byId = new Map(courses.map((c) => [c.id, c]));
  return {
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    note: book.note ?? "",
    courseIds: book.courseIds,
    linked: book.courseIds
      .map((courseId) => byId.get(courseId))
      .filter((course): course is NonNullable<typeof course> => Boolean(course))
      .map((course) => ({ id: course.id, label: course.label })),
    allCourses: courses.map((course) => ({
      id: course.id,
      label: course.label,
    })),
  };
}

export async function bookCounts() {
  return countBooksByCourse();
}

/** Analytics: counts straight from Postgres. */
export async function analytics() {
  const [users, courses, books] = await Promise.all([
    listUsersAdminInnerCounts(),
    listCoursesView(),
    listBooks(),
  ]);
  return {
    ...users,
    courses: courses.length,
    activeCourses: courses.filter((c) => c.active).length,
    books: books.length,
    booksByCourse: [...(await bookCounts()).entries()],
  };
}

async function listUsersAdminInnerCounts() {
  const [all, active, pending, students, teachers] = await Promise.all([
    countUsers(),
    countUsers({ status: "active" }),
    countUsers({ status: "pending" }),
    countUsers({ role: "student" }),
    countUsers({ role: "teacher" }),
  ]);
  return {
    users: all,
    activeUsers: active,
    pendingUsers: pending,
    students,
    teachers,
  };
}

export { findCourseById };
