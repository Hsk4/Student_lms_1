import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, requireRole } from "@/middleware/auth";
import { ok } from "@/lib/respond";
import {
  analytics,
  bookCounts,
  getBookDetail,
  listAuditLog,
  listBooksAdmin,
  listParentLinks,
  listRequests,
  listUsersAdmin,
  linkGuardian,
  reissueParentInvite,
  rejectUser,
  reinstateUser,
  revokeParentInvite,
  setTeacherCourses,
  suspendUser,
  syncUsers,
  unlinkGuardian,
  assignRole,
  decideAccessRequest,
} from "@/controllers/admin-users";

const admin = [auth(), requireRole("admin", "super_admin")];

export const adminRoutes = Router();

/* Users */
adminRoutes.get(
  "/admin/users",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await listUsersAdmin(req))),
);
adminRoutes.post(
  "/admin/users/sync",
  auth(),
  requireRole("super_admin"),
  asyncHandler(async (req, res) => ok(res, await syncUsers(req))),
);
adminRoutes.post(
  "/admin/users/:id/role",
  ...admin,
  asyncHandler(async (req, res) => {
    await assignRole(req);
    ok(res, null);
  }),
);
adminRoutes.post(
  "/admin/users/:id/reject",
  ...admin,
  asyncHandler(async (req, res) => {
    await rejectUser(req);
    ok(res, null);
  }),
);
adminRoutes.post(
  "/admin/users/:id/suspend",
  ...admin,
  asyncHandler(async (req, res) => {
    await suspendUser(req);
    ok(res, null);
  }),
);
adminRoutes.post(
  "/admin/users/:id/reinstate",
  ...admin,
  asyncHandler(async (req, res) => {
    await reinstateUser(req);
    ok(res, null);
  }),
);
adminRoutes.patch(
  "/admin/users/:id/courses",
  ...admin,
  asyncHandler(async (req, res) => {
    await setTeacherCourses(req);
    ok(res, null);
  }),
);

/* Requests */
adminRoutes.get(
  "/admin/requests",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await listRequests(req))),
);
adminRoutes.post(
  "/admin/requests/:id/decision",
  ...admin,
  asyncHandler(async (req, res) => {
    await decideAccessRequest(req);
    ok(res, null);
  }),
);

/* Parents */
adminRoutes.get(
  "/admin/parent-links",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listParentLinks())),
);
adminRoutes.post(
  "/admin/parent-links/:id/revoke",
  ...admin,
  asyncHandler(async (req, res) => {
    await revokeParentInvite(req);
    ok(res, null);
  }),
);
adminRoutes.post(
  "/admin/parent-links/:id/reissue",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await reissueParentInvite(req))),
);
adminRoutes.post(
  "/admin/guardians",
  ...admin,
  asyncHandler(async (req, res) => {
    await linkGuardian(req);
    ok(res, null);
  }),
);
adminRoutes.delete(
  "/admin/guardians",
  ...admin,
  asyncHandler(async (req, res) => {
    await unlinkGuardian(req);
    ok(res, null);
  }),
);

/* Books detail + audit + analytics */
adminRoutes.get(
  "/admin/books",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listBooksAdmin())),
);
adminRoutes.get(
  "/admin/books/:id",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await getBookDetail(req))),
);
adminRoutes.get(
  "/admin/books-counts",
  ...admin,
  asyncHandler(async (_req, res) =>
    ok(res, Object.fromEntries(await bookCounts())),
  ),
);
adminRoutes.get(
  "/admin/audit-log",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listAuditLog())),
);
adminRoutes.get(
  "/admin/analytics",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await analytics())),
);
