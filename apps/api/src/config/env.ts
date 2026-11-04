import { z } from "zod";

/**
 * Every environment variable the API reads, validated once at startup.
 *
 * Nothing here is printed: a missing or malformed value fails the process with
 * the variable *names* only, never their contents.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  AUTH_JWT_SECRET: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  WEB_APP_URL: z.string().url().optional(),
  /**
   * The production web origin(s) allowed through CORS. Comma-separated, e.g.
   * `https://studentlms-sooty.vercel.app`. Local dev origins are added by
   * `corsOrigins()` in `app.ts` and only when NODE_ENV is not production.
   */
  WEB_ORIGIN: z.string().optional(),
  /**
   * Wildcard matchers for hosting previews (Vercel per-deploy hostnames).
   * Comma-separated; `*` matches any run of characters in a host, e.g.
   * `https://studentlms-*-<team-slug>.vercel.app`. Matched against the exact
   * `Origin` the browser sent and only ever used to *add* origins — never as
   * `Access-Control-Allow-Origin: *`.
   */
  PREVIEW_ORIGIN_PATTERNS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid environment variables: ${names}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    const secret = parsed.data.AUTH_JWT_SECRET ?? parsed.data.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("Invalid environment variables: AUTH_JWT_SECRET (minimum 32 characters required in production)");
    }
    if (!parsed.data.RESEND_API_KEY || !parsed.data.AUTH_EMAIL_FROM || !parsed.data.WEB_APP_URL) {
      // Sign-in must not depend on email being configured: only password
      // recovery does, and that route already fails safe (see me.ts).
      console.warn("[api] RESEND_API_KEY / AUTH_EMAIL_FROM / WEB_APP_URL not set: password recovery email is disabled");
    }
  }
  return parsed.data;
}
