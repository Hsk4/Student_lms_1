import { Router } from "express";

export const webhookRoutes = Router();

webhookRoutes.all("/webhooks/clerk", (_req, res) => {
  res.status(410).json({
    error: "Webhooks are disabled in this local/custom-auth build.",
  });
});
