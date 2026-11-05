import type { Request } from "express";
import {
  accessRequestSchema,
  parentRequestBodySchema,
  teacherRequestBodySchema,
  type GateUser,
  type ParentRequestBody,
  type TeacherRequestBody,
} from "@lms/shared";
import { conflict } from "@/lib/http-error";
import { actorOf } from "@/middleware/auth";
import {
  createAccessRequest,
  findOpenRequestForUser,
  updateAccessRequest,
  type AccessRequestWrite,
} from "@/db/queries/access-requests";
import { findUserById, updateUser } from "@/db/queries/users";

/**
 * A pending or rejected account files an access request. Rejected users may
 * re-apply 30 days after `rejectedAt`; the request moves the account back to
 * pending. Ported from `actions/onboarding.ts`.
 *
 * Two application shapes are accepted (see `accessRequestSchema`):
 *  - the structured teacher/parent form, stored in `application_data`
 *  - the legacy board/level/subjects/note form, still used by the parent
 *    sign-up page's one-click request and by older clients
 */

function reapplyDateOf(rejectedAt: Date | null | undefined): Date | null {
  if (!rejectedAt) return null;
  const reapplyAt = new Date(rejectedAt);
  reapplyAt.setDate(reapplyAt.getDate() + 30);
  return reapplyAt;
}

function assertCanApply(
  status: string,
  rejectedAt: Date | null | undefined,
  role: string | null,
) {
  /*
   * A role IS the approval: an account that already holds one (the seeded super
   * admin, or anyone an admin assigned) has nothing to request. Without this a
   * super admin could file a request and demote themselves into the approval
   * queue. Checked before the status, because the seeded account may be
   * `pending`-with-a-role.
   */
  if (role) throw conflict("Your account already has a role");
  if (status === "active") throw conflict("Your account is already active");
  const reapplyAt = reapplyDateOf(rejectedAt);
  if (status === "rejected" && reapplyAt && reapplyAt > new Date()) {
    throw conflict(
      `You may re-apply from ${reapplyAt.toISOString().slice(0, 10)}`,
    );
  }
}

/** Reopen a rejected account in the local DB-backed identity model. */
async function reopenRejectedAccount(user: GateUser) {
  if (user.status !== "rejected") return;
  await updateUser(user.id, {
    status: "pending",
    rejectedAt: null,
    rejectionReason: null,
  });
}

/**
 * Turn the validated body into the rows' columns.
 *
 * A structured body (`requestedRole` + `application`) keeps the teacher/parent
 * half verbatim, and mirrors what the review needs into real columns: the
 * subjects into `access_request_subjects` (so approval can pre-tick courses)
 * and the grade levels into `teacher_grade_level_ids`.
 */
type Written = Omit<AccessRequestWrite, "userId" | "name" | "email">;

/** A legacy body is the all-caps-free shape: catalog fields plus a note. */
type LegacyBody = Partial<Omit<Written, "application" | "requestedRole">>;

/**
 * A structured body, re-parsed on its own so its exact shape survives typing.
 * Returns null for anything else, which is then handled as a legacy body.
 */
function parseStructured(body: unknown): TeacherRequestBody | ParentRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const requestedRole = (body as { requestedRole?: unknown }).requestedRole;
  const parsed =
    requestedRole === "teacher"
      ? teacherRequestBodySchema.safeParse(body)
      : null;
  if (parsed?.success) return parsed.data;
  const parentParsed =
    requestedRole === "parent" ? parentRequestBodySchema.safeParse(body) : null;
  return parentParsed?.success ? parentParsed.data : null;
}

function fromTeacherRequest(data: TeacherRequestBody): Written {
  const teacher = data.application;
  return {
    requestedRole: "teacher",
    application: { teacher, parent: null },
    boardId: null,
    levelId: null,
    subjectIds: teacher.subjects,
    gradeLevelIds: teacher.gradeLevels,
    // A teacher's "note" is their motivation, so the list view has a line to
    // show even before the admin opens the details.
    note: teacher.motivation.slice(0, 1000),
    phone: data.phone ?? null,
  };
}

function fromParentRequest(data: ParentRequestBody): Written {
  const parent = data.application;
  return {
    requestedRole: "parent",
    application: { teacher: null, parent },
    boardId: null,
    levelId: null,
    subjectIds: [],
    gradeLevelIds: [],
    note: parent.motivation.slice(0, 1000),
    phone: data.phone ?? null,
  };
}

function fromStructuredRequest(data: TeacherRequestBody | ParentRequestBody): Written {
  return "subjects" in data.application
    ? fromTeacherRequest(data as TeacherRequestBody)
    : fromParentRequest(data as ParentRequestBody);
}

/**
 * A body without a structured `application` is the legacy shape: no
 * role-specific answers, and `note` is the whole application.
 */
function fromLegacyRequest(body: LegacyBody): Written {
  const legacy = body as {
    requestedRole?: "teacher" | "student" | "parent";
    boardId?: string;
    levelId?: string;
    subjectIds?: string[];
    note?: string;
    phone?: string;
  };
  return {
    requestedRole: legacy.requestedRole ?? null,
    application: null,
    boardId: legacy.boardId ?? null,
    levelId: legacy.levelId ?? null,
    subjectIds: legacy.subjectIds ?? [],
    gradeLevelIds: [],
    note: legacy.note ?? null,
    phone: legacy.phone ?? null,
  };
}

/** `POST /api/v1/me/request` */
export async function submitAccessRequest(req: Request) {
  const actor = actorOf(req);
  assertCanApply(actor.status, actor.rejectedAt, actor.role);

  /*
   * The body is validated before anything is read from it. A structured
   * application and the role it came with are validated together, so a teacher
   * form cannot smuggle in parent answers or an unknown role.
   */
  const data = accessRequestSchema.parse(req.body);
  /*
   * `application` separates the two shapes. It is never trusted as a role: the
   * structured body was re-validated above, together with the role it states.
   */
  const structured = parseStructured(req.body);
  const write = structured
    ? fromStructuredRequest(structured)
    : fromLegacyRequest(req.body as LegacyBody);
  /*
   * The email on the form is where the office replies, but the account is the
   * identity: a request can never be filed for someone else's account, and the
   * applicant's own address is kept as a fallback when they leave it out.
   */
  const email = data.email || actor.email;

  const dbUser = await findUserById(actor.id);
  if (!dbUser) throw conflict("Account not found");

  const existing = await findOpenRequestForUser(dbUser.id);
  const input: AccessRequestWrite = {
    userId: dbUser.id,
    name: data.name,
    email,
    ...write,
  };

  if (existing) {
    await updateAccessRequest(existing.id, input);
  } else {
    await createAccessRequest(input);
  }

  await reopenRejectedAccount(dbUser);
}

/**
 * `POST /api/v1/me/request/parent` — one click for a guardian: same path as the
 * full form, only `requestedRole: "parent"` and no catalog fields.
 */
export async function requestParentAccess(req: Request) {
  const actor = actorOf(req);
  if (actor.status === "active") return;
  assertCanApply(actor.status, actor.rejectedAt, actor.role);

  const dbUser = await findUserById(actor.id);
  if (!dbUser) throw conflict("Account not found");

  const existing = await findOpenRequestForUser(dbUser.id);
  if (existing) {
    await updateAccessRequest(existing.id, {
      userId: dbUser.id,
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      boardId: existing.boardId,
      levelId: existing.levelId,
      subjectIds: existing.subjectIds,
      gradeLevelIds: existing.gradeLevelIds,
      requestedRole: "parent",
      application: null,
      note: existing.note || "Requested from the parent sign-up page.",
    });
  } else {
    await createAccessRequest({
      userId: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: null,
      boardId: null,
      levelId: null,
      subjectIds: [],
      gradeLevelIds: [],
      note: "Requested from the parent sign-up page.",
      requestedRole: "parent",
      application: null,
    });
  }

  await reopenRejectedAccount(dbUser);
}
