import { getSessionUser, type UserRole } from "./roles";
import { findUserByClerkId } from "@/lib/queries/users";
import {
  findActiveEnrollmentBetween,
  findEnrollmentById,
} from "@/lib/queries/enrollment";
import { isGuardianOf } from "@/lib/queries/guardianships";
import { recordIdSchema } from "@lms/shared";
import type { Id } from "@/lib/types";

export class AuthzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthzError";
  }
}

/** The Postgres uuid of the signed-in user, needed for audit entries and ownership checks. */
export async function requireActorId(): Promise<Id> {
  const session = await getSessionUser();
  if (!session) throw new AuthzError("Unauthorized: not signed in");

  const user = await findUserByClerkId(session.clerkId);
  if (!user) throw new AuthzError("Unauthorized: account not found");
  return user.id;
}

/**
 * Row-level guard. Passes when the session user is active and has one of the
 * roles. Server actions call it too: the panel guard does not protect a POST.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getSessionUser();

  if (!session) {
    throw new AuthzError("Unauthorized: not signed in");
  }

  if (!session.role || session.status !== "active") {
    throw new AuthzError("Unauthorized: missing role or not active");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new AuthzError(
      `Unauthorized: role ${session.role} not in ${allowedRoles.join(", ")}`,
    );
  }

  const actorId = await requireActorId();

  return { ...session, actorId };
}

/** Any signed-in, active account, whatever its role. */
export async function requireActiveUser() {
  const session = await getSessionUser();

  if (!session) {
    throw new AuthzError("Unauthorized: not signed in");
  }

  if (session.status !== "active") {
    throw new AuthzError("Unauthorized: account is not active");
  }

  return session;
}

export async function requireTeacherOf(clerkId: string, studentId: string) {
  const studentUuid = recordIdSchema.parse(studentId);
  const session = await requireRole(["teacher"]);

  if (session.clerkId !== clerkId) {
    throw new AuthzError("Unauthorized: not authenticated as this teacher");
  }

  const enrollment = await findActiveEnrollmentBetween(
    session.actorId,
    studentUuid,
  );

  if (!enrollment) {
    throw new AuthzError(
      "Unauthorized: no active enrollment for this teacher and student",
    );
  }

  return session;
}



/** A single enrollment is visible to its student, teacher, linked parent, or an admin. */
export async function requireEnrollmentAccess(enrollmentId: string) {
  const id = recordIdSchema.parse(enrollmentId);
  const session = await requireActiveUser();

  const enrollment = await findEnrollmentById(id);
  if (!enrollment) throw new AuthzError("Enrollment not found");

  if (session.role === "super_admin" || session.role === "admin") {
    return { session, enrollment };
  }

  const actor = await findUserByClerkId(session.clerkId);
  if (!actor) throw new AuthzError("Unauthorized: account not found");

  if (enrollment.studentId === actor.id || enrollment.teacherId === actor.id) {
    return { session, enrollment };
  }

  if (session.role === "parent") {
    const isGuardian = await isGuardianOf(actor.id, enrollment.studentId);
    if (isGuardian) return { session, enrollment };
  }

  throw new AuthzError("Unauthorized: no access to this enrollment");
}

export async function requireParentOf(clerkId: string, studentId: string) {
  const studentUuid = recordIdSchema.parse(studentId);
  const session = await requireRole(["parent"]);

  if (session.clerkId !== clerkId) {
    throw new AuthzError("Unauthorized: not authenticated as this parent");
  }

  const parent = await findUserByClerkId(clerkId);
  if (!parent || parent.role !== "parent" || parent.status !== "active") {
    throw new AuthzError("Unauthorized: not a parent or not active");
  }

  if (!(await isGuardianOf(parent.id, studentUuid))) {
    throw new AuthzError("Unauthorized: student not linked to this parent");
  }

  return session;
}

/** The Postgres uuid of the signed-in parent, or an error. */
export async function requireParentActor(): Promise<{
  actorId: Id;
  session: Awaited<ReturnType<typeof requireRole>>;
}> {
  const session = await requireRole(["parent"]);
  return { actorId: session.actorId, session };
}
