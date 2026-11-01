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
  /**
   * The production web origin(s) allowed through CORS. Comma-separated, e.g.
   * `https://studentlms-sooty.vercel.app`. Local dev origins are added by
   * `corsOrigins()` in `app.ts` and only when NODE_ENV is not production.
   */
  WEB_ORIGIN: z.string().optional(),
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
  return parsed.data;
}
