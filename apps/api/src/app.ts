import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  AUTH_VERIFIER,
  clerkTokenVerifier,
  type TokenVerifier,
} from "@/middleware/auth";
import { errorHandler, notFoundHandler } from "@/middleware/error-handler";
import { webhookRoutes } from "@/routes/webhooks";
import { healthRoutes, meRoutes } from "@/routes/me";
import { parentLinkRoutes, studentParentLinkRoutes } from "@/routes/parent";

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest. `server.ts` owns the socket and the database shutdown.
 */

/** Production web origin, the dev server, and the Capacitor webview origins. */
function corsOrigins(): string[] {
  const origins = [
    process.env.WEB_ORIGIN,
    "http://localhost:3000",
    // Capacitor: iOS uses the custom scheme, Android the https scheme.
    "capacitor://localhost",
    "https://localhost",
  ].filter((origin): origin is string => Boolean(origin));
  return [...new Set(origins)];
}

export function createApp(
  options: { verifyToken?: TokenVerifier } = {},
): Express {
  if (options.verifyToken) {
    (globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER] =
      options.verifyToken;
  } else if (!(globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER]) {
    (globalThis as Record<symbol, TokenVerifier>)[AUTH_VERIFIER] =
      clerkTokenVerifier();
  }

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins(),
      allowedHeaders: ["Authorization", "Content-Type"],
      methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
  );

  // Before express.json(): the svix signature is over the raw body.
  app.use(webhookRoutes);

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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
