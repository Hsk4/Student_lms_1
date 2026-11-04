import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  AUTH_VERIFIER,
  localTokenVerifier,
  type TokenVerifier,
} from "@/middleware/auth";
import { errorHandler, notFoundHandler } from "@/middleware/error-handler";
import { healthRoutes, meRoutes } from "@/routes/me";
import { parentLinkRoutes, studentParentLinkRoutes } from "@/routes/parent";
import { adminRoutes } from "@/routes/admin";
import { catalogRoutes } from "@/routes/catalog";
import { panelRoutes } from "@/routes/panels";

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest. `server.ts` owns the socket and the database shutdown.
 */

/**
 * Origins the browser and the native webview call the API from.
 *
 * - `WEB_ORIGIN` comes from the deployment: comma-separated, so one Render
 *   service can serve Vercel previews and production without a wildcard.
 * - `http://localhost:3000` and `localhost:5173` are *development only*. A
 *   production API that allows them is not a vulnerability (a hostile site
 *   cannot claim that origin), but it does mean a stray local dev build can
 *   write to production data, so they are gated on NODE_ENV.
 * - The two Capacitor webview origins are always allowed: the Android app
 *   loads `out/` from `https://localhost`, and iOS from `capacitor://localhost`.
 *   No wildcard is ever used.
 */
function corsOrigins(): { origins: string[]; patterns: RegExp[] } {
  const configured = (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => {
      /*
       * A browser sends `Origin` as a bare scheme://host[:port] — never with a
       * trailing slash, a path or a query. A value copied out of the address
       * bar arrives with all three, and `cors` matches the header as a plain
       * string, so any extra character silently disables the whole entry.
       * Parsing through `URL` and taking `.origin` strips them all; the
       * regex is only a fallback for a value `URL` rejects.
       */
      const trimmed = origin.trim();
      if (!trimmed) return "";
      try {
        return new URL(trimmed).origin;
      } catch {
        return trimmed.replace(/[/?#].*$/, "");
      }
    })
    .filter(Boolean);

  const dev =
    process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://localhost:5173", "http://localhost:3100"];

  /* The Android webview loads the export from `https://localhost`; iOS uses
   * `capacitor://localhost`. Both are always allowed, never a wildcard. */
  const webview = ["capacitor://localhost", "https://localhost"];

  /*
   * Vercel preview deployments get a fresh per-deploy hostname
   * (`<project>-<hash>-<team-slug>.vercel.app`), so an exact-match allowlist
   * would need editing after every push. `PREVIEW_ORIGIN_PATTERNS` takes
   * comma-separated matchers instead — `*` matches one or more characters
   * within a host label, e.g.
   *
   *   PREVIEW_ORIGIN_PATTERNS=https://studentlms-*-hammads-projects-095fbd61.vercel.app
   *
   * A pattern is only ever matched against a literal origin the browser
   * sent; allowing `studentlms-*` on your own project's preview hosts is far
   * narrower than a wildcard, and the host suffix in the pattern is the part
   * that matters — another team cannot deploy under it.
   */
  const patterns = (process.env.PREVIEW_ORIGIN_PATTERNS ?? "")
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => {
      /*
       * Split on `*` first, escape each literal run, then join the runs with
       * `.+`. Doing it in that order avoids needing a placeholder character —
       * and the escape table correctly turns `.` in `vercel.app` into `\.`,
       * which is the whole point of not using the raw string.
       */
      const body = pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".+");
      return new RegExp(`^${body}$`, "i");
    });

  return { origins: [...new Set([...configured, ...dev, ...webview])], patterns };
}

export function createApp(
  options: { verifyToken?: TokenVerifier } = {},
): Express {
  if (options.verifyToken) {
    (globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER] =
      options.verifyToken;
  } else if (!(globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER]) {
    (globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER] =
      localTokenVerifier();
  }

  const app = express();

  // Render terminates TLS at one trusted ingress proxy. Trust that single hop
  // so IP-based API and sign-in rate limits use the real client address.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      /*
       * A callback, not an array: the exact allowlist answers from a Set, and
       * preview deployments are matched by pattern. Returning `false` (not
       * throwing) makes `cors` omit `Access-Control-Allow-Origin` entirely, so
       * an unlisted origin is refused by the browser rather than allowed.
       */
      origin: (origin, callback) => {
        const { origins, patterns } = corsOrigins();
        // No `Origin` header: a same-origin or non-browser caller (curl, the
        // Android webview's native fetch). CORS does not apply; allow it.
        if (!origin) return callback(null, true);
        const allowed =
          origins.includes(origin) || patterns.some((re) => re.test(origin));
        callback(null, allowed);
      },
      allowedHeaders: ["Authorization", "Content-Type"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      // Auth is a bearer token, never a cookie: credentials stay off so the
      // browser does not expect `Access-Control-Allow-Credentials`.
      credentials: false,
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "256kb" }));

  app.use(
    "/api/v1",
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
      limit: Number(process.env.RATE_LIMIT_MAX ?? 300),
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.use("/api/v1", healthRoutes);
  app.use("/api/v1", meRoutes);
  app.use("/api/v1", studentParentLinkRoutes);
  app.use("/api/v1", parentLinkRoutes);
  app.use("/api/v1", catalogRoutes);
  app.use("/api/v1", adminRoutes);
  app.use("/api/v1", panelRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
