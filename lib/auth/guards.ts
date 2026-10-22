import { getSessionUser, type UserRole } from "./roles";
import { User } from "@/models/user";
import { Enrollment } from "@/models/enrollment";
import { connectDB } from "@/lib/db";
import { isGuardianOf } from "@/lib/guardians";
import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export class AuthzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthzError";
  }
}

/** The Mongo _id of the signed-in user, needed for audit entries and ownership checks. */
export async function requireActorId(): Promise<string> {
  const session = await getSessionUser();
  if (!session) throw new AuthzError("Unauthorized: not signed in");

  await connectDB();
  const user = await User.findOne({ clerkId: session.clerkId })
    .select("_id")
    .lean();
  if (!user) throw new AuthzError("Unauthorized: account not found");
  return String(user._id);
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
  const studentObjectId = objectIdSchema.parse(studentId);
  const session = await requireRole(["teacher"]);

  if (session.clerkId !== clerkId) {
    throw new AuthzError("Unauthorized: not authenticated as this teacher");
  }

  await connectDB();

  const enrollment = await Enrollment.findOne({
    teacherId: session.actorId,
    studentId: studentObjectId,
    state: "active",
  })
    .select("_id")
    .lean();

  if (!enrollment) {
    throw new AuthzError("Unauthorized: no active enrollment for this teacher and student");
  }

  return session;
}

/** A single enrollment is visible to its student, teacher, linked parent, or an admin. */
export async function requireEnrollmentAccess(enrollmentId: string) {
  const id = objectIdSchema.parse(enrollmentId);
  const session = await requireActiveUser();
  await connectDB();

  const enrollment = await Enrollment.findById(id).lean();
  if (!enrollment) throw new AuthzError("Enrollment not found");

  if (session.role === "super_admin" || session.role === "admin") return { session, enrollment };

  const actor = await User.findOne({ clerkId: session.clerkId }).select("_id").lean();
  if (!actor) throw new AuthzError("Unauthorized: account not found");

  if (
    String(enrollment.studentId) === String(actor._id) ||
    String(enrollment.teacherId) === String(actor._id)
  ) {
    return { session, enrollment };
  }

  if (session.role === "parent") {
    const isGuardian = await isGuardianOf(actor._id.toString(), String(enrollment.studentId));
    if (isGuardian) return { session, enrollment };
  }

  throw new AuthzError("Unauthorized: no access to this enrollment");
}

export async function requireParentOf(clerkId: string, studentId: string) {
  objectIdSchema.parse(studentId);
  const session = await requireRole(["parent"]);

  if (session.clerkId !== clerkId) {
    throw new AuthzError("Unauthorized: not authenticated as this parent");
  }

  await connectDB();

  const parent = await User.findOne({
    clerkId,
    role: "parent",
    status: "active",
  })
    .select("_id")
    .lean();

  if (!parent) {
    throw new AuthzError("Unauthorized: not a parent or not active");
  }

  if (!(await isGuardianOf(String(parent._id), studentId))) {
    throw new AuthzError("Unauthorized: student not linked to this parent");
  }

  return session;
}

/** The Mongo _id of the signed-in parent, or an error. */
export async function requireParentActor(): Promise<{
  actorId: string;
  session: Awaited<ReturnType<typeof requireRole>>;
}> {
  const session = await requireRole(["parent"]);
  return { actorId: session.actorId, session };
}
