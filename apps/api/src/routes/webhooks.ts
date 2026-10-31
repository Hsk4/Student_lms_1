import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { clerkWebhook } from "@/controllers/webhooks";

/**
 * Mounted at the app root, before `express.json()`: svix needs the exact raw
 * bytes it signed, so this router parses its own body as a Buffer.
 */
export const webhookRoutes = Router();

webhookRoutes.post(
  "/webhooks/clerk",
  rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7" }),
  express.raw({ type: "application/json", limit: "1mb" }),
  clerkWebhook,
);
