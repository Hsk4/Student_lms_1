# Development Workflow

**Purpose:** how to take a requirement and turn it into a safe, tested change in
this repository — and how to avoid breaking a part you were not looking at.

---

## 1. The shape of every change

Almost every feature request in this application touches the same chain:

```text
Requirement
    │
    ▼
1. Find the feature documentation   (docs/features/)
    │
    ▼
2. Find the page the user sees      (apps/web/app/<path>/page.tsx)
    │
    ▼
3. Find the API call it makes       (the useAsync / api.post line)
    │
    ▼
4. Find the route                   (apps/api/src/routes/)
    │
    ▼
5. Find the controller              (apps/api/src/controllers/)
    │
    ▼
6. Find the query                   (apps/api/src/db/queries/)
    │
    ▼
7. Change the schema if needed      (apps/api/src/db/schema.ts + migration)
    │
    ▼
8. Typecheck → test → lint → build
    │
    ▼
9. Commit and push
```

You do not always start at step 1. If you know the screen, start at step 2. If
you know the endpoint, start at step 4. The point is that the chain is always
the same, so you can enter it anywhere and walk in both directions.

---

## 2. A worked example

**Requirement:** _"Admins should be able to see when a user last signed in."_

### Step 1 — Find the feature

`docs/features/` has a document per feature. This is user management, so read
[Users and Roles](../features/users-and-roles.md).

### Step 2 — Find the page

The admin user list is `apps/web/app/admin/users/page.tsx`. The detail view is
`apps/web/app/admin/users/detail/user-detail-view.tsx`.

### Step 3 — Find the API call

At the top of the page:

```tsx
const usersQuery = useAsync(
  () =>
    api.get<UsersResponse>("/admin/users", {
      status,
      role,
      q,
      page: rawPage,
      pageSize: PAGE_SIZE,
    }),
  [status, role, q, rawPage],
);
```

So the endpoint is `GET /admin/users`.

### Step 4 — Find the route

`apps/api/src/routes/admin.ts`:

```ts
adminRoutes.get(
  "/admin/users",
  ...admin, // auth() + requireRole("admin", "super_admin")
  asyncHandler(async (req, res) => ok(res, await listUsersAdmin(req))),
);
```

### Step 5 — Find the controller

`apps/api/src/controllers/admin-users.ts` → `listUsersAdmin`. It reads the query
parameters, calls the query layer, and shapes the response.

### Step 6 — Find the query

`apps/api/src/db/queries/users.ts` → `listAllUsers`. This is where the SQL lives.

### Step 7 — Change the schema

`lastSignedInAt` does not exist yet, so add it to the `users` table in
`apps/api/src/db/schema.ts`:

```ts
lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
```

Then generate and apply the migration:

```bash
bun run --cwd apps/api db:generate   # writes a new .sql file — read it first
bun run --cwd apps/api db:migrate
```

### Step 8 — Wire it through

1. Set the column in the sign-in controller (`apps/api/src/routes/me.ts`).
2. Return it from `listUsersAdmin`.
3. Add it to the `UserRow` type in the page.
4. Render it in the table.

### Step 9 — Verify

```bash
bun run typecheck
bun run test
bun run lint
```

---

## 3. Before you start: the three rules

### Rule 1 — The API is the only gate

The web app's guards (`usePanelGuard`) are **user experience only**. They stop a
user seeing a page they cannot use; they do not stop them calling the API.

If you add a feature, the permission check must be in the **route**
(`requireRole(...)`) or the **controller** (an ownership check). Never only in
the UI.

### Rule 2 — Change the schema, then generate

Never write a migration by hand unless you have to. Edit `schema.ts`, run
`db:generate`, and **read the generated SQL** before applying it. Drizzle is
good at this, but a rename can look like a drop-and-create.

### Rule 3 — One page, one fetch

There is no global cache. A page fetches what it needs with `useAsync`, and
after a mutation it calls its own `reload()`. If you add a mutation, pass the
page's `reload` down as `onDone` — do not invent a cache key.

---

## 4. Common change recipes

### Add a field to an existing table

1. `apps/api/src/db/schema.ts` — add the column.
2. `bun run --cwd apps/api db:generate` — creates a migration.
3. Read the generated SQL. If it drops and recreates, fix it.
4. `bun run --cwd apps/api db:migrate`.
5. Update the query that reads the row (`db/queries/`).
6. Update the response type (`packages/shared/src/api-types.ts` if shared).
7. Update the page that displays it.

### Add a new endpoint

1. Decide the path and who may call it.
2. Add the route in `apps/api/src/routes/`.
3. Write the controller in `apps/api/src/controllers/`.
4. Write the query in `apps/api/src/db/queries/`.
5. Add a validator in `packages/shared/src/validators/` if it takes a body.
6. Add a test in `apps/api/tests/`.

Full walkthrough: [How Do I…](../guides/how-do-i.md#how-do-i-add-a-new-api-endpoint).

### Add a new page

1. Create `apps/web/app/<path>/page.tsx`.
2. Add `"use client"` at the top — every page here is client-rendered.
3. Fetch data with `useAsync` / `useApi`.
4. Add the link to the panel's nav config (`apps/web/components/shell/nav-config.ts`).
5. If it is a panel page, the layout's guard already protects it.

### Change who can do something

Find the route and change the `requireRole(...)` list:

```ts
// before: only admins
adminRoutes.get("/admin/audit-log", ...admin, handler);

// after: admins and teachers
adminRoutes.get(
  "/admin/audit-log",
  auth(),
  requireRole("admin", "super_admin", "teacher"),
  handler,
);
```

Then check the web guard in the matching `layout.tsx` so the UI agrees.

### Change an API response

1. Change the controller.
2. Update the type in `packages/shared/src/api-types.ts` (or the page's local type).
3. `bun run typecheck` — it will point at every place that needs updating.

---

## 5. Testing your change

| What you changed | What to run                                             |
| ---------------- | ------------------------------------------------------- |
| Anything         | `bun run typecheck`                                     |
| API logic        | `bun run test`                                          |
| UI               | `bun run lint`, then click through the page             |
| Schema           | `bun run --cwd apps/api db:migrate` on a fresh database |
| Shared types     | `bun run typecheck` (it checks all three packages)      |

The test suite is **integration** tests: they start the real Express app and
talk to a real Postgres. They do not mock the database, so a broken query fails
the test.

> **Before running tests**, make sure the test database exists and is migrated.
> See [Getting Started](./00-getting-started.md#running-the-tests).

---

## 6. Committing

The repository does not enforce a commit format, but the existing history uses
conventional prefixes:

```text
fix(api): let pending accounts read the request form's options
fix(web): gate pages clear the topbar; remove Clerk from the UI
refactor(web): remove TanStack Query entirely
docs: add getting started and project overview
ci: fix the release workflow's leading space
chore: release v1.0.3
```

Write the **why** in the body, not the what. The diff already shows the what.

---

## 7. Releasing

The Android APK is published automatically from a tag:

```bash
# bump the version first
# apps/web/android/app/build.gradle -> versionCode +1, versionName "x.y.z"

git add -A
git commit -m "chore: release v1.0.4"
git push origin main
git tag -a v1.0.4 -m "Fastly LMS v1.0.4"
git push origin v1.0.4
```

The `Release` workflow builds the web export, assembles the APK, and attaches it
to a GitHub release. See [Production](../deployment/production.md).

---

## 8. Things that will bite you

| Symptom                                       | Cause                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A page shows old data after a change          | You forgot to call `reload()` / pass `onDone`.                                                                     |
| A new page 404s on refresh                    | The static export needs a folder with `index.html`; check the build ran.                                           |
| `NEXT_PUBLIC_API_URL` change does nothing     | It is baked in at build time. Restart or rebuild.                                                                  |
| A new endpoint returns 403 for a pending user | `auth()` refuses non-active accounts. Use `auth({ allowRestricted: true })` if the endpoint is part of onboarding. |
| Types pass but the app crashes                | A response shape changed and a page still assumes the old one. Check `api-types.ts`.                               |
| `bun install --frozen-lockfile` fails in CI   | `bun.lock` was not committed after a `package.json` change.                                                        |

---

## 9. Where to go next

- [API Overview](../backend/01-api-overview.md)
- [Web Overview](../frontend/01-web-overview.md)
- [How Do I…](../guides/how-do-i.md)
- [Debugging](../guides/debugging.md)

---

## Files this document was based on

- `apps/web/app/admin/users/page.tsx` — the worked example
- `apps/api/src/routes/admin.ts`, `controllers/admin-users.ts`, `db/queries/users.ts`
- `apps/api/src/middleware/auth.ts` — the `allowRestricted` rule
- `apps/web/lib/use-async.ts` — the `reload` / `onDone` pattern
- `apps/web/components/shell/nav-config.ts` — where nav entries are added
- `.github/workflows/release.yml` — the release process
- `git log` — the commit message conventions
