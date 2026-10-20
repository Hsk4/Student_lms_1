/**
 * A transaction session is not serializable across the client boundary, so only
 * plain data leaves a server action.
 */
export type ActionState = { ok: boolean; message?: string };

export function toState(error: unknown): ActionState {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return { ok: false, message: issues.map((i) => i.message).join(". ") };
  }
  if (error instanceof Error) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong" };
}
