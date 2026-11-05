# Controllers

**Purpose:** understand where the API's decisions are made — validation,
permission checks, business rules — and how to write a new one.

Controllers live in `apps/api/src/controllers/`. A controller receives a
`Request`, does the work, and **returns data**. It never writes a response.

---

## 1. The shape of a controller

```ts
export async function assignRole(req: Request) {
  const actor = actorAdmin(req);                                  // 1. who is asking
  const input = assignRoleSchema.parse({ ...req.body, userId: req.params.id }); // 2. validate

  await db.transaction(async (tx) => {                            // 3. one transaction
    const user = await findUserById(input.userId, tx);
    if (!user) throw notFound("User not found");                  // 4. rules
    if (!canManage(actor.role, user.role)) throw forbidden("You cannot change this user");

    await updateUser(user.id, { role: input.role, status: "active" }, tx);
    await writeAudit({ ... }, tx);                                // 5. audit
  });
}
```

Five steps, always in that order:

| Step | What               | Why                                          |
| ---- | ------------------ | -------------------------------------------- |
| 1    | Get the actor      | Every decision depends on who is asking      |
| 2    | Validate the input | Reject bad data before touching the database |
| 3    | Open a transaction | Multi-table changes must be all-or-nothing   |
| 4    | Apply the rules    | The actual business logic                    |
| 5    | Write an audit row | Every admin action is recorded               |

The route wraps the return value:

```ts
asyncHandler(async (req, res) => ok(res, await assignRole(req)));
```

---

## 2. Getting the actor

`actorOf(req)` returns the signed-in account, guaranteed by `auth()`:

```ts
import { actorOf } from "@/middleware/auth";

const actor = actorOf(req); // GateUser: id, role, status, onboarded, …
```

Some controllers narrow it further:

```ts
function actorAdmin(
  req: Request,
): GateUser & { role: "admin" | "super_admin" } {
  const actor = actorOf(req);
  if (actor.role !== "admin" && actor.role !== "super_admin") throw forbidden();
  return actor as GateUser & { role: "admin" | "super_admin" };
}
```

> **Why narrow it again when the route already checked?** The route's
> `requireRole` is a string list; this gives the controller a _typed_ role, so
> `actor.role === "super_admin"` is checked by the compiler rather than by
> memory.

---

## 3. Validation

Most controllers call `.parse()` directly, so the result is typed:

```ts
const input = assignRoleSchema.parse({ ...req.body, userId: req.params.id });
// input: { userId: string; role: "admin" | "teacher" | "student" | "parent" }
```

The schemas live in `packages/shared/src/validators/` so the web form and the
API agree on the rules.

A failed parse throws `ZodError`, which the error handler turns into a `400`
with the messages joined.

> **Why not the `validate()` middleware?** It exists, but `.parse()` inside the
> controller keeps the parsed value in scope and typed. Use whichever reads
> better; both end up in the same error handler.

---

## 4. Permission checks

There are two kinds, and they live in different places.

### Role checks — in the route

```ts
adminRoutes.get("/admin/users", ...admin, handler);
```

### Record-level checks — in the controller

A role check says "an admin may do this". It does not say _which_ records. That
is the controller's job:

```ts
function canManage(
  actorRole: "super_admin" | "admin",
  targetRole: string | null,
) {
  if (targetRole === "super_admin") return false; // nobody manages a super admin
  if (targetRole === "admin") return actorRole === "super_admin"; // only a super admin manages admins
  return true; // anyone else is fair game
}
```

> **This is the rule from the README:** _"Role gates live in the routes;
> record-level ownership checks live in the controllers."_ If you add an
> endpoint that touches one user's data, the "is this _their_ data?" check
> belongs in the controller.

---

## 5. Transactions

Anything that changes more than one table uses `db.transaction`:

```ts
await db.transaction(async (tx) => {
  await updateUser(user.id, { role, status: "active" }, tx);
  await tx.update(accessRequests).set({ state: "approved", decidedBy: actor.id });
  await writeAudit({ actorId: actor.id, action: "assignRole", ... }, tx);
});
```

Pass `tx` to every query inside the block. If anything throws, **all** of it
rolls back.

> **Why this matters:** approving a request without closing it would leave the
> queue showing an approved user as still waiting. The transaction is what makes
> that impossible.

---

## 6. The audit log

Every admin action writes a row:

```ts
await writeAudit(
  {
    actorId: actor.id,
    action: "assignRole",
    targetType: "User",
    targetId: user.id,
    before: { role: user.role, status: user.status },
    after: { role: input.role, status: "active" },
  },
  tx,
);
```

`before` and `after` are what make the log useful — "who changed what, from
what, to what".

> **Add an audit row to any new admin action.** The audit page is the school's
> record of who did what; a gap there is a gap in accountability.

---

## 7. Errors

Controllers **throw**; they never call `res.status(...)`.

```ts
import { badRequest, conflict, forbidden, notFound } from "@/lib/http-error";

if (!user) throw notFound("User not found");
if (alreadyLinked.length >= 5)
  throw conflict("You already have the maximum number of guardians linked");
if (actor.role !== "student") throw forbidden("Student account not found");
```

| Helper              | Status                       |
| ------------------- | ---------------------------- |
| `badRequest(msg)`   | 400                          |
| `unauthorized(msg)` | 401                          |
| `forbidden(msg)`    | 403                          |
| `notReady(msg)`     | 403 (account not usable yet) |
| `notFound(msg)`     | 404                          |
| `conflict(msg)`     | 409                          |

The message is shown to the user, so write it as a sentence they can act on.

---

## 8. The controller files

| File             | Covers                                                 |
| ---------------- | ------------------------------------------------------ |
| `me.ts`          | The signed-in account: profile, access requests        |
| `onboarding.ts`  | Filing an access request, requesting the parent role   |
| `admin-users.ts` | Users, roles, requests, parent links, audit, analytics |
| `catalog.ts`     | Boards, levels, subjects, courses, books, materials    |
| `parent.ts`      | Link codes: create, revoke, redeem                     |
| `teacher.ts`     | The teacher panel: students, classes, requests         |
| `teaching.ts`    | Classes, assignments, attendance, meetings             |
| `student.ts`     | The student panel: courses, work, books, materials     |
| `assessment.ts`  | Quizzes and grades                                     |
| `parent-panel.ts`| The parent panel: children, meetings                   |
| `invoices.ts`    | Fees                                                   |
| `support.ts`     | Support tickets                                        |

> The route file `routes/panels.ts` is one file, but its controllers are split
> by domain across the files above.

---

## 9. Writing a new controller

```ts
// src/controllers/reports.ts
import type { Request } from "express";
import { z } from "zod";
import { actorOf } from "@/middleware/auth";
import { listReports } from "@/db/queries/reports";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function getReports(req: Request) {
  actorOf(req); // 1. who
  const query = querySchema.parse(req.query); // 2. validate
  return listReports(query); // 3. query, return data
}
```

Then wire it:

```ts
// src/routes/admin.ts
adminRoutes.get(
  "/admin/reports",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await getReports(req))),
);
```

And test it in `apps/api/tests/`.

---

## 10. Related

- [Routes](./02-routes.md)
- [Database](./04-database.md)
- [Authentication](./05-authentication.md)

---

## Files this document was based on

- `apps/api/src/controllers/admin-users.ts` — the worked example
- `apps/api/src/controllers/parent.ts`, `me.ts`, `catalog.ts`
- `apps/api/src/lib/http-error.ts`
- `apps/api/src/middleware/auth.ts` — `actorOf`
- `apps/api/src/lib/audit.ts` — `writeAudit`
- `packages/shared/src/validators/`
