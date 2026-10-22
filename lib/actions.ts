/**
 * A transaction session is not serializable across the client boundary, so only
 * plain data leaves a server action.
 */
export type ActionState<T = void> = T extends void
  ? { ok: boolean; message?: string; error?: string }
  : { ok: boolean; message?: string; error?: string; data?: T };

export function toState<T = void>(error: unknown): ActionState<T> {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return { ok: false, error: issues.map((i) => i.message).join(". ") } as ActionState<T>;
  }
  if (error instanceof Error) return { ok: false, error: error.message } as ActionState<T>;
  return { ok: false, error: "Something went wrong" } as ActionState<T>;
}
