import type mongoose from "mongoose";
import { User } from "@/models/user";

/**
 * The parent/student relation is stored twice:
 *  - `student.guardianIds[]` on the child is the source of truth (a child may
 *    have several guardians, a guardian may have several children).
 *  - `parent.childIds[]` on the guardian mirrors it so a parent can list its
 *    children with one indexed query.
 *
 * Always link and unlink through these helpers so both sides stay in step.
 * Pass the transaction session whenever the link is part of a larger mutation.
 */

type LinkOptions = {
  /** Mark the child as onboarded once the link succeeds (first parent only). */
  markOnboarded?: boolean;
};

export async function linkParentToStudent(
  parentId: string | mongoose.Types.ObjectId,
  studentId: string | mongoose.Types.ObjectId,
  options: LinkOptions = {},
  session?: mongoose.ClientSession,
): Promise<void> {
  await User.updateOne(
    { _id: studentId, "student.guardianIds": { $ne: parentId } },
    { $addToSet: { "student.guardianIds": parentId } },
    { session },
  );
  await User.updateOne(
    { _id: parentId, "parent.childIds": { $ne: studentId } },
    { $addToSet: { "parent.childIds": studentId } },
    { session },
  );

  if (options.markOnboarded) {
    await User.updateOne(
      { _id: studentId },
      { $set: { onboarded: true } },
      { session },
    );
  }
}

export async function unlinkParentFromStudent(
  parentId: string | mongoose.Types.ObjectId,
  studentId: string | mongoose.Types.ObjectId,
  session?: mongoose.ClientSession,
): Promise<void> {
  await User.updateOne(
    { _id: studentId },
    { $pull: { "student.guardianIds": parentId } },
    { session },
  );
  await User.updateOne(
    { _id: parentId },
    { $pull: { "parent.childIds": studentId } },
    { session },
  );
}

/**
 * True when the student lists this parent as a guardian. Checks both sides so a
 * half-written link from an older record still passes.
 */
export async function isGuardianOf(
  parentId: string,
  studentId: string,
): Promise<boolean> {
  const [student, parent] = await Promise.all([
    User.findById(studentId).select("student.guardianIds").lean(),
    User.findById(parentId).select("parent.childIds").lean(),
  ]);

  const guards = (student?.student?.guardianIds ?? []) as unknown[];
  const children = (parent?.parent?.childIds ?? []) as unknown[];

  return (
    guards.some((id) => String(id) === parentId) ||
    children.some((id) => String(id) === studentId)
  );
}

export type ChildRow = {
  id: string;
  name: string;
  email: string;
  boardName: string | null;
  levelName: string | null;
};

/** Students linked to a parent. The row guard for every parent panel page. */
export async function listGuardianChildren(
  parentId: string,
): Promise<ChildRow[]> {
  const linked = await User.findById(parentId).select("parent.childIds").lean();
  const childIds = (linked?.parent?.childIds ?? []).map(String);

  const children = await User.find({
    _id: { $in: childIds },
    role: "student",
    status: "active",
  })
    .select("name email student.boardId student.levelId")
    .populate("student.boardId", "name")
    .populate("student.levelId", "name")
    .lean();

  return children
    .map((child) => ({
      id: String(child._id),
      name: child.name,
      email: child.email,
      boardName:
        (child.student?.boardId as unknown as { name?: string } | null)?.name ??
        null,
      levelName:
        (child.student?.levelId as unknown as { name?: string } | null)?.name ??
        null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
