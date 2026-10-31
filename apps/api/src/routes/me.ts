import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth } from "@/middleware/auth";
import { freshStatus, me, myRequestStatus } from "@/controllers/me";
import { requestParentAccess, submitAccessRequest } from "@/controllers/onboarding";
import { ok } from "@/lib/respond";

export const meRoutes = Router();

// The onboarding routes must answer for a pending, rejected or not-onboarded
// account; everything else requires an active, onboarded one (see `auth`).
const restricted = auth({ allowRestricted: true });

meRoutes.get(
  "/me",
  restricted,
  asyncHandler(async (req, res) => ok(res, await me(req))),
);
meRoutes.get(
  "/me/request",
  restricted,
  asyncHandler(async (req, res) => ok(res, await myRequestStatus(req))),
);
meRoutes.post(
  "/me/request",
  restricted,
  asyncHandler(async (req, res) => {
    await submitAccessRequest(req);
    ok(res, null);
  }),
);
meRoutes.post(
  "/me/request/parent",
  restricted,
  asyncHandler(async (req, res) => {
    await requestParentAccess(req);
    ok(res, null);
  }),
);
meRoutes.get(
  "/me/status",
  restricted,
  asyncHandler(async (req, res) => ok(res, await freshStatus(req))),
);

export const healthRoutes = Router();
healthRoutes.get("/health", (_req, res) => ok(res, { status: "ok" }));
