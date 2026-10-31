# Migration plan: single Next.js app -> Express API + Next.js web + Capacitor

Status: **approved and executed**. Companion to `ARCHITECTURE-REFACTOR.md` (decisions D1-D10, phases).
This document was written before any code (Step A of the refactor) and is kept as the record of what moved where; the `Executed as` column says where each item actually landed.

Behavior must not change: roles, statuses, guards, ownership rules, audit entries, zod schemas, transactions, the database schema (tables, columns, types), whole-PKR integers and UTC storage are all preserved.

---

## 0. Facts recorded before any code

| Check (baseline, phase 0) | Result                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `next build`              | passed, 59 routes, `cacheComponents` on                                                              |
| `eslint`                  | 0 errors, 5 unused-variable warnings                                                                 |
| `lint:colors`             | **failed**: `backdrop-blur` in `panel-shell.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx` (fixed in phase 5) |
| `tsc --noEmit`            | added as a script in phase 1                                                                         |

Schema lives in one file, `db/schema.ts` (26 tables, uuid ids); migrations in `db/migrations/`.

---

## 1. File migration map (and where it landed)

| From                                                         | To                                                                                     | Executed as                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `db/schema.ts`                                               | `apps/api/src/db/schema.ts`                                                            | `git mv`, unchanged                                          |
| `db/migrations/**`                                           | `apps/api/src/db/migrations/**`                                                        | `git mv`, unchanged; `drizzle-kit generate` reports no drift |
| `drizzle.config.ts`                                          | `apps/api/drizzle.config.ts`                                                           | moved, paths adjusted                                        |
| `db/client.ts`                                               | `apps/api/src/db/index.ts`                                                             | rewritten (Next reload cache removed)                        |
| `db/errors.ts`, `db/mappers.ts`, `db/schema` imports         | `apps/api/src/db/*`                                                                    | moved                                                        |
| `actions/*` (18 files)                                       | `apps/api/src/controllers/*`                                                           | rewritten per domain                                         |
| `lib/queries/*`                                              | `apps/api/src/db/queries/*` (used by controllers)                                      | moved                                                        |
| `lib/types`, `lib/actions.ts`                                | `apps/api/src/db/types.ts`, `packages/shared` (`@lms/shared`)                          | moved / rewritten                                            |
| `lib/validators/*`                                           | `packages/shared/src/validators/*`                                                     | moved; `onboarding.ts` deleted (unused)                      |
| `lib/auth/roles.ts`                                          | `@lms/shared` (`ROLE_HOME`, `homeFor`, `GateUser`) + `apps/api/src/middleware/auth.ts` | split                                                        |
| `lib/auth/guards.ts`                                         | `apps/api/src/lib/ownership.ts` + `requireRole` middleware                             | rewritten                                                    |
| `lib/audit.ts`, `link-codes.ts`, `guardians.ts`              | `apps/api/src/lib/*`, `apps/api/src/db/queries/guardianships.ts`                       | moved; `guardians.ts` re-export deleted                      |
| `lib/email.ts`, `lib/auth/parent-invite.ts`                  | deleted                                                                                | unused (no email provider; codes not invitations)            |
| `app/api/webhooks/clerk`                                     | `POST /webhooks/clerk` (`apps/api/src/routes/webhooks.ts`)                             | before `express.json()`, raw body                            |
| `app/api/status`                                             | `GET /api/v1/me` (+ `/me/status`)                                                      | replaced                                                     |
| `app/**/page.tsx`                                            | `apps/web/app/**/page.tsx` (client)                                                    | rewritten against the API                                    |
| `app/*/[id]/page.tsx`                                        | `.../detail/page.tsx?id=`                                                              | 7 routes                                                     |
| `components/**`                                              | unchanged paths inside `apps/web`                                                      | kept                                                         |
| `proxy.ts`, `lib/auth/demo.ts`, `scripts/seed-demo-users.ts` | deleted                                                                                | cannot exist without a Next server                           |
| `scripts/seed-*.ts`                                          | `apps/api/scripts/*`                                                                   | `bun run seed:dev`, `seed:super-admin`                       |
| `qa/`                                                        | unchanged                                                                              | untouched                                                    |

---

## 2. Server actions -> REST endpoints

Base `/api/v1`. Envelope `{ ok: true, data }` / `{ ok: false, error }`; 400 validation, 401 unauthenticated, 403 forbidden/not-ready, 404 missing, 409 conflict. Role gate in the route, ownership in the controller.

| Group       | Endpoints                                                                                                                                                                                                                                                                                                                               | Notes                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Session     | `GET /me`, `GET /me/request`, `GET /me/status`, `POST /me/request`, `POST /me/request/parent`                                                                                                                                                                                                                                           | `/me` also returns `home` and `pendingRequests`   |
| Admin users | `GET/POST /admin/users*` (`:id`, `:id/role`, `:id/reject`, `:id/suspend`, `:id/reinstate`, `:id/courses`, `sync`)                                                                                                                                                                                                                       | two-phase Clerk update with compensating rollback |
| Requests    | `GET /admin/requests`, `POST /admin/requests/:id/decision`                                                                                                                                                                                                                                                                              | audit via assign/reject                           |
| Catalog     | `GET /catalog/form-options`, `GET /admin/catalog`, `GET/POST/PATCH/DELETE /admin/{boards,levels,subjects,courses,books,materials}(/:id)(/active)`                                                                                                                                                                                       | every write audited in-transaction                |
| Enrollment  | `POST /student/enrollments`, `POST /teacher/enrollments/:id/decision`, `GET /enrollments/:id`, `POST /teacher/classes(/:id/past)`, `GET /student/teachers`, `GET /teacher/students/:id(/detail)`, `GET /parent/children`, `GET /admin/enrollments`, `POST /admin/enrollments/:id/reassign`, `POST /admin/enrollments/cancel-mismatched` | reassignment in one transaction                   |
| Teacher     | `GET /teacher/{dashboard,students,requests,classes,classes/:id,assignments,attendance,meetings,courses,counts}`                                                                                                                                                                                                                         | every query filtered by the actor                 |
| Student     | `GET /student/{courses,assignments,attendance,grades,books,materials,profile,submissions,course-options,book-options,quizzes,guardians}`, `POST /student/{submissions,parent-links,parent-links/:id/revoke}`                                                                                                                            | own id only                                       |
| Parent      | `GET /parent/{overview,children/:id,meetings}`, `POST /parent/meetings(/:id/reschedule)`, `POST /parent/parent-links/redeem`                                                                                                                                                                                                            | `isGuardianOf` before every child                 |
| Assessment  | `POST /teacher/assignments`, `POST /teacher/submissions/:id/grade`, `POST /teacher/attendance`                                                                                                                                                                                                                                          | unique-violation on double submit                 |
| Meetings    | `POST /teacher/meetings/:id/{confirm,request-slot}`                                                                                                                                                                                                                                                                                     | teacher of the meeting only                       |
| Invoices    | `GET /invoices?studentId=`, `GET/POST /admin/invoices`, `POST /admin/invoices/:id/paid`                                                                                                                                                                                                                                                 | admin any, student self, parent linked child      |
| Support     | `GET/POST /support/tickets`, `POST /support/tickets/:id/messages`, `POST /admin/tickets/:id/escalate`                                                                                                                                                                                                                                   | creator or admin                                  |
| Admin reads | `GET /admin/{audit-log,analytics,parent-links,parent-links/options,books-counts}`                                                                                                                                                                                                                                                       |                                                   |
| Health      | `GET /api/v1/health`                                                                                                                                                                                                                                                                                                                    |                                                   |

---

## 3. `[id]` routes -> query params

| Old                                                  | New                                                     |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `/admin/users/[id]`                                  | `/admin/users/detail/?id=`                              |
| `/admin/courses/[id]`                                | `/admin/courses/detail/?id=`                            |
| `/admin/books/[id]`                                  | `/admin/books/detail/?id=`                              |
| `/teacher/classes/[id]`                              | `/teacher/classes/detail/?id=`                          |
| `/teacher/students/[id]`                             | `/teacher/students/detail/?id=`                         |
| `/parent/children/[id]`                              | `/parent/children/detail/?id=`                          |
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | `/sign-in`, `/sign-up` (static export has no catch-all) |

---

## 4. Decisions taken while executing

1. **Status redirects in the API.** `checkAccess` sent suspended users to the login page, so the API answers **401** for suspended and **403** for pending/rejected/not-onboarded, with the `homeFor` path in the message so the web guard can mirror the old redirect exactly.
2. **Adoption when the webhook has not landed.** A verified token with no mirror row is treated as `pending` (the product rule for missing metadata) when Clerk cannot confirm it; `/me` still answers so the client can navigate.
3. **Demo sign-in removed** (`LMS_DEMO_ROLE`, `demo_<role>` cookie, `proxy.ts` short-circuit, `seed-demo-users.ts`). It cannot exist without a Next server.
4. **Parent linking is the link code**, ported as-is; Clerk invitations are not used anywhere.
5. **`onboarded` is not flipped by an admin-issued link.** The redeem endpoint requires an onboarded student, so `linkParentToStudent({ markOnboarded: true })` never helps the onboarding page today. Ported unchanged; flagged, not "fixed".
6. **Extra dependency:** none beyond ARCHITECTURE-REFACTOR.md; Capacitor 8, TanStack Query and Clerk React were all named there.

---

## 5. Verification

- API: eslint clean, `tsc --noEmit` clean, build clean, **28/28 vitest tests** against a real `postgres:15` (docker `lms-test-db`, port 5434, truncated between tests): 401/403 gates, suspended/pending/rejected/not-onboarded, parent-child, teacher-student, student-student isolation, audit rows, double redeem 409.
- Migration parity: `drizzle-kit generate` prints "No schema changes"; the existing migration applies to a fresh database.
- Web: `output: "export"` build produces `out/` with every route; `tsc` clean; `eslint` clean; `lint:colors` clean.
- Mobile: Android project generated, debug APK builds; emulator run not possible on this machine (see ARCHITECTURE-REFACTOR.md section 6).
