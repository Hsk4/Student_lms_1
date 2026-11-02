type ResetEmailInput = {
  to: string;
  name: string;
  token: string;
};

/**
 * Send a one-time password reset link through Resend.
 * Configure RESEND_API_KEY, AUTH_EMAIL_FROM and WEB_APP_URL in the API host.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: ResetEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  const appUrl = process.env.WEB_APP_URL ?? process.env.WEB_ORIGIN?.split(",")[0]?.trim();

  if (!apiKey || !from || !appUrl) {
    throw new Error("Password recovery email is not configured (RESEND_API_KEY, AUTH_EMAIL_FROM, WEB_APP_URL)");
  }

  const origin = new URL(appUrl);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("WEB_APP_URL must use HTTPS outside localhost");
  }

  const resetUrl = new URL("/reset-password/", origin);
  resetUrl.searchParams.set("token", token);

  const safeName = name.replace(/[<>&"']/g, "");
  const text = [
    `Hello ${safeName || "there"},`,
    "",
    "We received a request to reset your Fastly LMS password.",
    "This link expires in 30 minutes and can only be used once:",
    resetUrl.toString(),
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `<p>Hello ${safeName || "there"},</p><p>We received a request to reset your Fastly LMS password.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your Fastly LMS password",
      text,
      html,
    }),
  });

  if (!response.ok) {
    // Do not log the email body or reset token.
    throw new Error(`Password recovery email provider returned HTTP ${response.status}`);
  }
}
