import { Router } from "express";
import { asyncHandler } from "@/middleware/async-handler";
import { auth, requireRole } from "@/middleware/auth";
import { ok } from "@/lib/respond";
import {
  createBoardRow,
  createBookRow,
  createCourseRow,
  createLevelRow,
  createMaterialRow,
  createSubjectRow,
  courseOptions,
  deleteMaterialRow,
  formOptions,
  getBoardDetail,
  getCourseDetail,
  listCatalog,
  listCoursesView,
  listMaterialsAdmin,
  toggleBoardRow,
  toggleCourseRow,
  toggleLevelRow,
  toggleSubjectRow,
  updateBoardRow,
  updateBookRow,
  updateCourseRow,
  updateLevelRow,
  updateSubjectRow,
} from "@/controllers/catalog";

const admin = [auth(), requireRole("admin", "super_admin")];

export const catalogRoutes = Router();

// Any active account may read the form options.
catalogRoutes.get(
  "/catalog/form-options",
  auth(),
  asyncHandler(async (_req, res) => ok(res, await formOptions())),
);

// Admin catalog reads.
catalogRoutes.get(
  "/admin/catalog",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listCatalog())),
);
catalogRoutes.get(
  "/admin/courses",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listCoursesView())),
);
catalogRoutes.get(
  "/admin/courses/:id",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await getCourseDetail(req))),
);
catalogRoutes.get(
  "/admin/materials",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listMaterialsAdmin())),
);
catalogRoutes.get(
  "/admin/boards/:id",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await getBoardDetail(req))),
);
catalogRoutes.get(
  "/admin/catalog/teacher-courses",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await courseOptions())),
);

// Catalog writes.
const creators: [
  string,
  (req: Parameters<typeof createBoardRow>[0]) => Promise<void>,
][] = [
  ["/admin/boards", createBoardRow],
  ["/admin/levels", createLevelRow],
  ["/admin/subjects", createSubjectRow],
  ["/admin/courses", createCourseRow],
  ["/admin/books", createBookRow],
  ["/admin/materials", createMaterialRow],
];
for (const [path, handler] of creators) {
  catalogRoutes.post(
    path,
    ...admin,
    asyncHandler(async (req, res) => {
      await handler(req);
      ok(res, null);
    }),
  );
}

const updates: [
  string,
  (req: Parameters<typeof updateBoardRow>[0]) => Promise<void>,
][] = [
  ["/admin/boards", updateBoardRow],
  ["/admin/levels", updateLevelRow],
  ["/admin/subjects", updateSubjectRow],
  ["/admin/courses", updateCourseRow],
  ["/admin/books", updateBookRow],
];
for (const [path, handler] of updates) {
  catalogRoutes.patch(
    `${path}/:id`,
    ...admin,
    asyncHandler(async (req, res) => {
      await handler(req);
      ok(res, null);
    }),
  );
}

const toggles: [
  string,
  (req: Parameters<typeof toggleBoardRow>[0]) => Promise<void>,
][] = [
  ["/admin/boards", toggleBoardRow],
  ["/admin/levels", toggleLevelRow],
  ["/admin/subjects", toggleSubjectRow],
  ["/admin/courses", toggleCourseRow],
];
for (const [path, handler] of toggles) {
  catalogRoutes.patch(
    `${path}/:id/active`,
    ...admin,
    asyncHandler(async (req, res) => {
      await handler(req);
      ok(res, null);
    }),
  );
}

catalogRoutes.delete(
  "/admin/materials/:id",
  ...admin,
  asyncHandler(async (req, res) => {
    await deleteMaterialRow(req);
    ok(res, null);
  }),
);


