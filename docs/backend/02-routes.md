# Routes

**Purpose:** a complete map of the API's URLs — what each one does, who may call
it, and which file defines it.

Every route lives in `apps/api/src/routes/`. A route file contains **only**
wiring: the path, the guards, and the controller to call. No business logic.

---

## 1. How a route is written

```ts
const admin = [auth(), requireRole("admin", "super_admin")];

adminRoutes.get(
  "/admin/users",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await listUsersAdmin(req))),
);
```

Read it as: _"`GET /admin/users` → require a valid token and an admin role →
run `listUsersAdmin` → wrap the result in `{ ok: true, data }`."_

### The guard vocabulary

| Guard                             | Meaning                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `auth()`                          | A valid token **and** an active account. Refuses `pending`, `rejected`, `suspended`, and a student who has not onboarded. |
| `auth({ allowRestricted: true })` | A valid token, whatever the account's status. Used only by the onboarding steps.                                          |
| `requireRole("teacher")`          | The account's role must be one of the listed roles.                                                                       |
| `asyncHandler(...)`               | Catches a rejected promise and passes it to the error handler.                                                            |

> **Why `allowRestricted` exists:** some endpoints are the _onboarding step
> itself_ — creating a link code, reading the request form's options. The
> default gate would refuse the only people who need them. See
> [Authentication](./05-authentication.md).

---

## 2. Public and account routes — `routes/me.ts`

Mounted at `/api/v1`.

| Method | Path                    | Guard    | What it does                                              |
| ------ | ----------------------- | -------- | --------------------------------------------------------- |
| `GET`  | `/health`               | none     | Liveness check. Returns `{ status: "ok" }`.               |
| `POST` | `/auth/sign-up`         | none     | Create an account (email + password).                     |
| `POST` | `/auth/sign-in`         | none     | Exchange email + password for a JWT.                      |
| `POST` | `/auth/forgot-password` | none     | Email a reset link (needs Resend configured).             |
| `POST` | `/auth/reset-password`  | none     | Set a new password from a reset token.                    |
| `GET`  | `/me`                   | `auth()` | The signed-in account, plus `home` and `pendingRequests`. |
| `GET`  | `/me/request`           | `auth()` | The status of the caller's access request.                |
| `POST` | `/me/request`           | `auth()` | File an access request.                                   |
| `POST` | `/me/request/parent`    | `auth()` | File a parent-role request (no board/level).              |
| `GET`  | `/me/status`            | `auth()` | A light status check.                                     |

> **Rate limits:** sign-in allows **10 attempts per 15 minutes per IP**
> (`AUTH_ATTEMPT_LIMIT` overrides it). Password-reset requests allow 3.

---

## 3. Onboarding routes — `routes/parent.ts`

| Method | Path                               | Guard                           | What it does                                         |
| ------ | ---------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `GET`  | `/student/guardians`               | `auth()` + student              | The student's linked guardians.                      |
| `POST` | `/student/parent-links`            | **`allowRestricted`** + student | Create a link code. **This is the onboarding step.** |
| `POST` | `/student/parent-links/:id/revoke` | **`allowRestricted`** + student | Cancel a code.                                       |
| `POST` | `/parent/parent-links/redeem`      | `auth()` + parent               | Redeem a code; links the parent to the student.      |

> The two `allowRestricted` routes are the reason a student can finish
> onboarding at all. Without them the gate answered `403` to the only call that
> clears it.

---

## 4. Admin routes — `routes/admin.ts`

All guarded by `auth()` + `requireRole("admin", "super_admin")`.

### Users

| Method  | Path                         | What it does                                |
| ------- | ---------------------------- | ------------------------------------------- |
| `GET`   | `/admin/users`               | Paged, filterable user list with counts.    |
| `GET`   | `/admin/users/:id`           | One user's detail.                          |
| `POST`  | `/admin/users/:id/role`      | Assign a role (also activates the account). |
| `POST`  | `/admin/users/:id/reject`    | Reject with a reason.                       |
| `POST`  | `/admin/users/:id/suspend`   | Suspend.                                    |
| `POST`  | `/admin/users/:id/reinstate` | Reinstate.                                  |
| `PATCH` | `/admin/users/:id/courses`   | Set a teacher's courses.                    |

### Access requests

| Method | Path                                             | What it does                                     |
| ------ | ------------------------------------------------ | ------------------------------------------------ |
| `GET`  | `/admin/requests?state=open\|approved\|rejected` | The request queue.                               |
| `POST` | `/admin/requests/:id/decision`                   | Approve (with a role) or reject (with a reason). |

### Parent links

| Method   | Path                              | What it does                         |
| -------- | --------------------------------- | ------------------------------------ |
| `GET`    | `/admin/parent-links`             | All link codes.                      |
| `GET`    | `/admin/parent-links/options`     | Parents and students to choose from. |
| `POST`   | `/admin/parent-links/:id/revoke`  | Cancel a code.                       |
| `POST`   | `/admin/parent-links/:id/reissue` | Issue a fresh code.                  |
| `POST`   | `/admin/guardians`                | Link a parent to a student directly. |
| `DELETE` | `/admin/guardians`                | Remove a link.                       |

### Books, audit, analytics

| Method | Path                  | What it does                |
| ------ | --------------------- | --------------------------- |
| `GET`  | `/admin/books`        | All books.                  |
| `GET`  | `/admin/books/:id`    | One book.                   |
| `GET`  | `/admin/books-counts` | Book counts per course.     |
| `GET`  | `/admin/audit-log`    | The last 200 audit entries. |
| `GET`  | `/admin/analytics`    | Dashboard numbers.          |

---

## 5. Catalogue routes — `routes/catalog.ts`

### Read

| Method | Path                             | Guard                 | What it does                                   |
| ------ | -------------------------------- | --------------------- | ---------------------------------------------- |
| `GET`  | `/catalog/form-options`          | **`allowRestricted`** | Boards, levels, subjects for the request form. |
| `GET`  | `/admin/catalog`                 | admin                 | The full catalogue.                            |
| `GET`  | `/admin/courses`                 | admin                 | Course list.                                   |
| `GET`  | `/admin/courses/:id`             | admin                 | One course.                                    |
| `GET`  | `/admin/boards/:id`              | admin                 | One board.                                     |
| `GET`  | `/admin/materials`               | admin                 | All materials.                                 |
| `GET`  | `/admin/catalog/teacher-courses` | admin                 | Courses with their teachers.                   |

> `/catalog/form-options` is `allowRestricted` because the request form is
> filled in by accounts that are **not active yet**. It used plain `auth()` and
> answered `403` to the only people who needed it.

### Write

These are generated in a loop, so they share one shape:

| Method   | Path                                                 | What it does      |
| -------- | ---------------------------------------------------- | ----------------- |
| `POST`   | `/admin/boards`                                      | Create a board    |
| `POST`   | `/admin/levels`                                      | Create a level    |
| `POST`   | `/admin/subjects`                                    | Create a subject  |
| `POST`   | `/admin/courses`                                     | Create a course   |
| `POST`   | `/admin/books`                                       | Create a book     |
| `POST`   | `/admin/materials`                                   | Create a material |
| `PATCH`  | `/admin/{boards,levels,subjects,courses,books}/:id`  | Update            |
| `PATCH`  | `/admin/{boards,levels,subjects,courses}/:id/active` | Toggle active     |
| `DELETE` | `/admin/materials/:id`                               | Delete a material |

---

## 6. Panel routes — `routes/panels.ts`

The largest file. Grouped by role:

```ts
const teacher = [auth(), requireRole("teacher")];
const student = [auth(), requireRole("student")];
const parent = [auth(), requireRole("parent")];
const admin = [auth(), requireRole("admin", "super_admin")];
const active = [auth()];
```

### Teacher

| Method | Path                                 | What it does                    |
| ------ | ------------------------------------ | ------------------------------- |
| `GET`  | `/teacher/dashboard`                 | Dashboard numbers               |
| `GET`  | `/teacher/students`                  | The teacher's students          |
| `GET`  | `/teacher/students/:id`              | One student                     |
| `GET`  | `/teacher/students/:id/detail`       | Full student detail             |
| `GET`  | `/teacher/requests`                  | Pending enrollment requests     |
| `GET`  | `/teacher/classes`                   | The teacher's classes           |
| `GET`  | `/teacher/classes/:id`               | One class                       |
| `POST` | `/teacher/classes`                   | Create a class                  |
| `POST` | `/teacher/classes/:id/past`          | Mark a class finished           |
| `GET`  | `/teacher/assignments`               | Assignments                     |
| `POST` | `/teacher/assignments`               | Create an assignment            |
| `POST` | `/teacher/submissions/:id/grade`     | Grade a submission              |
| `GET`  | `/teacher/attendance`                | Attendance sessions             |
| `POST` | `/teacher/attendance`                | Record attendance               |
| `GET`  | `/teacher/meetings`                  | Meetings                        |
| `POST` | `/teacher/meetings/:id/confirm`      | Confirm a meeting               |
| `POST` | `/teacher/meetings/:id/request-slot` | Propose a new slot              |
| `GET`  | `/teacher/courses`                   | The teacher's courses           |
| `GET`  | `/teacher/counts`                    | Badge counts                    |
| `POST` | `/teacher/enrollments/:id/decision`  | Accept or decline an enrollment |

### Student

| Method | Path                      | What it does             |
| ------ | ------------------------- | ------------------------ |
| `GET`  | `/student/courses`        | Enrolled courses         |
| `GET`  | `/student/assignments`    | Assignments              |
| `GET`  | `/student/attendance`     | Attendance               |
| `GET`  | `/student/grades`         | Grades                   |
| `GET`  | `/student/books`          | Books                    |
| `GET`  | `/student/materials`      | Materials                |
| `GET`  | `/student/profile`        | Profile                  |
| `GET`  | `/student/submissions`    | Submitted work           |
| `GET`  | `/student/course-options` | Courses to request       |
| `GET`  | `/student/book-options`   | Books to choose          |
| `GET`  | `/student/quizzes`        | Quizzes                  |
| `GET`  | `/student/teachers`       | Teachers to request      |
| `POST` | `/student/enrollments`    | Request a teacher/course |
| `POST` | `/student/submissions`    | Submit an assignment     |

### Parent

| Method | Path                              | What it does           |
| ------ | --------------------------------- | ---------------------- |
| `GET`  | `/parent/overview`                | All linked children    |
| `GET`  | `/parent/children`                | The same list, lighter |
| `GET`  | `/parent/children/:id`            | One child's detail     |
| `GET`  | `/parent/meetings`                | Meetings               |
| `POST` | `/parent/meetings`                | Request a meeting      |
| `POST` | `/parent/meetings/:id/reschedule` | Reschedule             |

### Shared and admin

| Method | Path                                   | Guard    | What it does               |
| ------ | -------------------------------------- | -------- | -------------------------- |
| `GET`  | `/enrollments/:id`                     | `active` | One enrollment             |
| `GET`  | `/invoices`                            | `active` | Invoices for a student     |
| `GET`  | `/admin/enrollments`                   | admin    | All enrollments            |
| `POST` | `/admin/enrollments/:id/reassign`      | admin    | Move to another teacher    |
| `POST` | `/admin/enrollments/cancel-mismatched` | admin    | Clean up stale enrollments |
| `GET`  | `/admin/invoices`                      | admin    | All invoices               |
| `POST` | `/admin/invoices`                      | admin    | Create an invoice          |
| `POST` | `/admin/invoices/:id/paid`             | admin    | Mark paid                  |
| `GET`  | `/support/tickets`                     | `active` | Tickets                    |
| `POST` | `/support/tickets`                     | `active` | Open a ticket              |
| `POST` | `/support/tickets/:id/messages`        | `active` | Reply                      |
| `POST` | `/admin/tickets/:id/escalate`          | admin    | Escalate                   |

---

## 7. Adding a route

1. Pick the file: `me.ts` (account), `admin.ts` (admin), `catalog.ts`
   (catalogue), `panels.ts` (role panels), `parent.ts` (onboarding).
2. Add the route with its guards.
3. Write the controller in `src/controllers/`.
4. Write the query in `src/db/queries/`.
5. Add a test in `apps/api/tests/`.

```ts
// routes/admin.ts
adminRoutes.get(
  "/admin/reports",
  ...admin,
  asyncHandler(async (_req, res) => ok(res, await listReports())),
);
```

> **Order matters.** Express matches in registration order, so a literal path
> should come before a parameterised one that could swallow it. In this file
> `/admin/books/:id` is registered *before* `/admin/books-counts`, and it still
> works — Express 5 prefers a literal segment over a parameter — but putting the
> literal first is the safer habit when you add a route.

---

## 8. Related

- [Controllers](./03-controllers.md)
- [Authentication](./05-authentication.md)
- [API Overview](./01-api-overview.md)

---

## Files this document was based on

- `apps/api/src/routes/me.ts`, `admin.ts`, `catalog.ts`, `panels.ts`, `parent.ts`
- `apps/api/src/app.ts` — mount order
- `apps/api/src/middleware/auth.ts` — the guard vocabulary
