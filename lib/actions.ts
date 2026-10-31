import { isUniqueViolation, postgresError } from "@/db/errors";

/**
 * A transaction session is not serializable across the client boundary, so only
 * plain data leaves a server action.
 */
export type ActionState<T = void> = T extends void
  ? { ok: boolean; message?: string; error?: string }
  : { ok: boolean; message?: string; error?: string; data?: T };

/**
 * Turns any thrown value into a displayable message.
 *
 * The database branch matters: a failed Drizzle write throws an `Error` whose
 * message is `Failed query: insert into ...` — useless and leaky. Classification
 * goes through `db/errors.ts` first, so an action that forgot a specific message
 * still cannot show the raw query to a user.
 */
export function toState<T = void>(error: unknown): ActionState<T> {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return {
      ok: false,
      error: issues.map((i) => i.message).join(". "),
    } as ActionState<T>;
  }
  if (error instanceof Error) {
    return { ok: false, error: messageFor(error) } as ActionState<T>;
  }
  return { ok: false, error: "Something went wrong" } as ActionState<T>;
}

function messageFor(error: Error): string {
  const pg = postgresError(error);
  if (!pg) return error.message;

  if (isUniqueViolation(error)) {
    const constraint = pg.constraint_name ?? "";
    if (constraint.startsWith("users_")) {
      return "An account with that email already exists.";
    }
    if (constraint.startsWith("parent_invites_")) {
      return "That link code is already in use. Try again.";
    }
    if (constraint.startsWith("submissions_")) {
      return "You have already submitted this assignment.";
    }
    return "That entry already exists.";
  }

  switch (pg.code) {
    case "23503":
      return "That change conflicts with a related record. Refresh and try again.";
    case "23514":
      return "That value is not allowed. Check the form and try again.";
    case "23502":
      return "A required field was missing.";
    default:
      return "The database rejected that change. Please try again.";
  }
}
