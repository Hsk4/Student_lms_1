import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, requireRole } from "@/middleware/auth";
import { ok } from "@/lib/respond";
import {
  createParentLink,
  listMyGuardians,
  redeemLinkCode,
  revokeParentLink,
} from "@/controllers/parent";

export const studentParentLinkRoutes = Router();

studentParentLinkRoutes.get(
  "/student/guardians",
  auth(),
  requireRole("student"),
  asyncHandler(async (req, res) => ok(res, await listMyGuardians(req))),
);

studentParentLinkRoutes.post(
  "/student/parent-links",
  auth(),
  requireRole("student"),
  asyncHandler(async (req, res) => ok(res, await createParentLink(req))),
);

studentParentLinkRoutes.post(
  "/student/parent-links/:id/revoke",
  auth(),
  requireRole("student"),
  asyncHandler(async (req, res) => {
    await revokeParentLink(req);
    ok(res, null);
  }),
);

export const parentLinkRoutes = Router();

parentLinkRoutes.post(
  "/parent/parent-links/redeem",
  auth(),
  requireRole("parent"),
  asyncHandler(async (req, res) => ok(res, await redeemLinkCode(req))),
);
