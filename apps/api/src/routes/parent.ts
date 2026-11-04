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

/*
 * Creating and revoking the link code IS the onboarding step, so these two
 * must pass the gate that holds an un-onboarded student back. Before this they
 * returned 403 "Account needs onboarding", which no client could resolve: the
 * only call that fixes onboarding was the one being refused.
 */
const onboardingStep = auth({ allowRestricted: true });

studentParentLinkRoutes.get(
  "/student/guardians",
  auth(),
  requireRole("student"),
  asyncHandler(async (req, res) => ok(res, await listMyGuardians(req))),
);

studentParentLinkRoutes.post(
  "/student/parent-links",
  onboardingStep,
  requireRole("student"),
  asyncHandler(async (req, res) => ok(res, await createParentLink(req))),
);

studentParentLinkRoutes.post(
  "/student/parent-links/:id/revoke",
  onboardingStep,
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
