/**
 * The parent/student relation, Postgres-backed.
 *
 * The old implementation kept the link twice — `student.guardianIds[]` on the
 * child and `parent.childIds[]` on the guardian — and told callers to update
 * both sides together. There is one `guardianships` table now, so a link cannot
 * be half-written, and every helper here is a thin, total wrapper over
 * `lib/queries/guardianships`.
 *
 * Re-exported from this path so existing imports keep working unchanged.
 */

export {
  isGuardianOf,
  linkParentToStudent,
  listGuardianChildren,
  listParentIdsForStudent,
  listStudentIdsForParent,
  unlinkParentFromStudent,
  type ChildRow,
} from "@/lib/queries/guardianships";
