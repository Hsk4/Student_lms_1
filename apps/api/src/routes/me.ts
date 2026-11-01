import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, createLocalSessionToken } from "@/middleware/auth";
import { freshStatus, me, myRequestStatus } from "@/controllers/me";
import { requestParentAccess, submitAccessRequest } from "@/controllers/onboarding";
import { findUserByEmail, createUser } from "@/db/queries/users";
import { ok } from "@/lib/respond";

export const meRoutes = Router();

// The onboarding routes must answer for a pending, rejected or not-onboarded
// account; everything else requires an active, onboarded one (see `auth`).
const restricted = auth({ allowRestricted: true });

meRoutes.post(
  "/auth/sign-in",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password are required" });
      return;
    }

    const user = await findUserByEmail(email);

    if (!user) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const token = createLocalSessionToken({
      sub: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      onboarded: user.onboarded,
    });

    ok(res, {
      token,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        onboarded: user.onboarded,
      },
    });
  }),
);

meRoutes.post(
  "/auth/sign-up",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const name = String(req.body?.name ?? "User").trim() || "User";

    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password are required" });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ ok: false, error: "An account with that email already exists" });
      return;
    }

    const user = await createUser({
      clerkId: `local-${email.replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      email,
      name,
      role: null,
      status: "pending",
      onboarded: false,
    });

    const token = createLocalSessionToken({
      sub: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      onboarded: user.onboarded,
    });

    ok(res, {
      token,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        onboarded: user.onboarded,
      },
    });
  }),
);

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
