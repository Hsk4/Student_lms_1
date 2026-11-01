import type { Request, Response } from "express";

export async function clerkWebhook(_req: Request, res: Response) {
  res.status(410).json({
    error: "Webhooks are disabled in this local/custom-auth build.",
  });
}
