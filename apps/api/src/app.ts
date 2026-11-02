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
function corsOrigins(): string[] {
  const configured = (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => {
      // A trailing slash survives a copy-paste from the browser; browsers never
      // send it in `Origin`, so it would silently disable the whole entry.
      const trimmed = origin.trim().replace(/\/+$/, "");
      try {
        return new URL(trimmed).origin;
      } catch {
        return trimmed;
      }
    })
    .filter(Boolean);

  const dev =
    process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://localhost:5173", "http://localhost:3100"];

  const webview = ["capacitor://localhost", "https://localhost"];

  return [...new Set([...configured, ...dev, ...webview])];
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
      origin: corsOrigins(),
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
