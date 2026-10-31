import "server-only";

/**
 * The objective leaves the email provider open. The UI displays the invite URL
 * in development; this adapter logs a structured notice and never claims that
 * an email was delivered.
 */
export async function sendParentInviteEmail(
  to: string,
  parentName: string,
  inviteUrl: string,
) {
  console.info("[parent invite email unavailable]", { to, parentName, inviteUrl });
  return { delivered: false, reason: "email provider not configured" } as const;
}
