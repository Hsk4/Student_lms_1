# Project Structure

**Purpose:** know what every important folder is for, so you can guess where a
piece of code lives before you search for it.

This is a map, not an inventory. Files that are obvious from their name are not
listed.

---

## 1. The top level

```text
Student_lms_1/
├── apps/
│   ├── api/            the backend (Express + Drizzle + PostgreSQL)
│   └── web/            the frontend (Next.js static export + Capacitor)
├── packages/
│   └── shared/         types and validators used by both
├── docs/               this documentation
├── brand-kit/          design assets and reference screenshots
├── .github/workflows/  CI and the release pipeline
├── package.json        workspace root: scripts that run across all packages
├── bun.lock            the lockfile — commit it
└── README.md           quick reference (partly out of date; see the note below)
```

> **Note:** the README still lists a `qa/` folder for screenshots. It no longer
> exists. Screenshots and one-off scripts now live in a local `qa-tmp/` folder
> that is git-ignored.

### Why a monorepo?

The API and the web app must agree on the shape of every request and response.
Putting them in one repository with a shared package means:

- one `bun install` sets up everything;
- a change to a shared type breaks the build in **both** places immediately;
- one pull request can change the API and the UI that uses it together.

---

## 2. `apps/api` — the backend

```text
apps/api/
├── src/
│   ├── server.ts          starts the HTTP server, handles shutdown
│   ├── app.ts             builds the Express app: CORS, rate limits, routes
│   ├── config/
│   │   └── env.ts         reads and validates environment variables
│   ├── routes/            URL paths → controllers
│   ├── controllers/       business logic for each endpoint
│   ├── middleware/        auth, error handling, async wrapper
│   ├── db/
│   │   ├── schema.ts      every table, in TypeScript
│   │   ├── index.ts       the database connection
│   │   ├── queries/       reusable database reads and writes
│   │   ├── migrations/    generated SQL, applied in order
│   │   └── errors.ts      recognises Postgres error codes
│   └── lib/               small helpers: responses, HTTP errors, passwords
├── scripts/               seed and maintenance scripts
├── tests/                 integration tests (vitest + supertest)
├── drizzle.config.ts      tells drizzle-kit where the schema and migrations are
└── package.json           scripts: dev, build, test, db:*
```

### The four layers, and what belongs in each

| Layer           | Folder             | Rule of thumb                                                               |
| --------------- | ------------------ | --------------------------------------------------------------------------- |
| **Routes**      | `src/routes/`      | Only wiring: which path, which guards, which controller. No logic.          |
| **Controllers** | `src/controllers/` | The decisions: validate, check permissions, call queries, write audit rows. |
| **Queries**     | `src/db/queries/`  | Only SQL. No HTTP, no permissions, no business rules.                       |
| **Schema**      | `src/db/schema.ts` | The tables. Change this, then generate a migration.                         |

> **Why split queries from controllers?** A query like `listUsersByRole` is
> reused by several endpoints. Keeping it free of HTTP concerns means it can be
> called from anywhere — including a seed script or a test — without dragging
> Express along.

### When would I modify each?

| I want to…                         | Go to                                               |
| ---------------------------------- | --------------------------------------------------- |
| Add or change a URL                | `src/routes/`                                       |
| Change what an endpoint does       | `src/controllers/`                                  |
| Change how data is read or written | `src/db/queries/`                                   |
| Add a column or table              | `src/db/schema.ts`, then `db:generate`              |
| Change who can call something      | `src/routes/` (the `auth()` / `requireRole()` line) |
| Change the login rules             | `src/middleware/auth.ts`                            |
| Change an error message            | `src/middleware/error-handler.ts`                   |

---

## 3. `apps/web` — the frontend

```text
apps/web/
├── app/                   one folder per URL (Next.js App Router)
│   ├── layout.tsx         the root layout: fonts, theme, providers
│   ├── page.tsx           the landing page  (/)
│   ├── sign-in/           /sign-in
│   ├── sign-up/           /sign-up  and  /sign-up/parent
│   ├── request/           /request   — the access request form
│   ├── pending/           /pending   — waiting for approval
│   ├── rejected/          /rejected
│   ├── onboarding/        /onboarding/parent — link a guardian
│   ├── admin/             /admin/**  — the admin panel
│   ├── teacher/           /teacher/** — the teacher panel
│   ├── student/           /student/** — the student panel
│   ├── parent/            /parent/**  — the parent panel
│   └── mobile/            /mobile     — the phone landing page
├── components/
│   ├── ui/                the design system: Button, Card, Table, Chip…
│   ├── shell/             the app frame: sidebar, topbar, page actions
│   ├── shared/            reusable pieces: empty states, skeletons, tables
│   ├── brand/             logo, illustrations, decorative primitives
│   └── support/           support-ticket forms
├── lib/                   the plumbing (see below)
├── views/                 larger composed screens (the root shell)
├── android/               the Capacitor Android project
├── out/                   the build output (generated, git-ignored)
└── next.config.ts         static export configuration
```

### `lib/` — the most important folder to understand

| File               | What it does                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `api-client.ts`    | The only way the app talks to the API. Adds the token, unwraps the response, throws `ApiError`. |
| `session.ts`       | Reads and writes the token in `localStorage`.                                                   |
| `auth-context.tsx` | `AuthProvider` and `useAuth()` — who is signed in, and their profile.                           |
| `use-async.ts`     | `useAsync`, `useApi`, `useAction` — the data layer.                                             |
| `guards.tsx`       | `usePanelGuard` — redirects a user out of a panel they do not belong in.                        |
| `queries.ts`       | Thin aliases over `use-async.ts`, kept for older call sites.                                    |
| `school.ts`        | The school's name, used everywhere it is displayed.                                             |
| `theme.ts`         | Light/dark theme handling.                                                                      |

> **Why is there no Redux, no React Query, no global store?** The session lives
> in `AuthProvider`; everything else is fetched by the page that needs it. See
> [Web Overview](../frontend/01-web-overview.md) for the reasoning.

### How a URL maps to a file

Next.js App Router: **the folder path is the URL**.

| URL                        | File                              |
| -------------------------- | --------------------------------- |
| `/`                        | `app/page.tsx`                    |
| `/sign-in`                 | `app/sign-in/page.tsx`            |
| `/admin/users`             | `app/admin/users/page.tsx`        |
| `/admin/users/detail?id=…` | `app/admin/users/detail/page.tsx` |
| `/parent/children`         | `app/parent/children/page.tsx`    |

A `layout.tsx` in a folder wraps every page beneath it. `app/admin/layout.tsx`
is what puts the admin sidebar around every admin page.

> **Why `?id=` instead of `/admin/users/[id]`?** A static export cannot
> pre-render an unknown id, so detail pages take the id as a query parameter and
> read it inside a `Suspense` boundary.

---

## 4. `packages/shared` — the contract

```text
packages/shared/src/
├── index.ts        re-exports everything
├── roles.ts        USER_ROLES, USER_STATUSES, ROLE_HOME, homeFor()
├── api-types.ts    the shape of API responses (MeResponse, …)
└── validators/     zod schemas for request bodies
```

**What goes here:** anything both sides must agree on — a role name, a status
value, the shape of a response, a validation rule.

**What does not:** React components, database code, or anything that only one
side uses.

> **Why `homeFor()` lives here:** both the API (to decide a 403 message) and the
> web app (to decide where to redirect) need the same answer to "where does this
> account belong?". Two copies would drift.

---

## 5. `brand-kit`

Design assets: the logo, colour definitions, and reference screenshots of the
intended look. It is **not** imported by the application — it is a reference for
whoever is building UI.

Modify it only when the brand itself changes.

---

## 6. `.github/workflows`

| File          | What it does                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `ci.yml`      | On every push and pull request: install, migrate, typecheck, build, test, lint.                                |
| `release.yml` | On a `v*` tag: build the web export, assemble the Android APK, publish a GitHub release with the APK attached. |

---

## 7. Generated and ignored files

These exist on your machine but are **not** in the repository. Never edit them
by hand, and never commit them.

| Path                          | What it is              |
| ----------------------------- | ----------------------- |
| `node_modules/`               | Installed dependencies  |
| `apps/web/out/`               | The static build output |
| `apps/web/.next/`             | Next.js build cache     |
| `apps/api/dist/`              | Compiled API output     |
| `apps/web/android/app/build/` | Android build output    |
| `*.tsbuildinfo`, `*.log`      | Build caches and logs   |
| `.env`, `.env.local`          | Your real secrets       |

---

## 8. Where do I look for…?

A quick index for common questions.

| Question                                 | Look in                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| "What does this URL return?"             | `apps/api/src/routes/`                                               |
| "Why did this request fail?"             | `apps/api/src/controllers/` then `middleware/error-handler.ts`       |
| "What columns does this table have?"     | `apps/api/src/db/schema.ts`                                          |
| "Where is this SQL written?"             | `apps/api/src/db/queries/`                                           |
| "Why can't this user do that?"           | `apps/api/src/middleware/auth.ts` and the route's `requireRole(...)` |
| "Where is this screen?"                  | `apps/web/app/<path>/page.tsx`                                       |
| "Where is this button defined?"          | `apps/web/components/ui/`                                            |
| "How does this page get its data?"       | the `useAsync(...)` call at the top of the page                      |
| "Why did the user get logged out?"       | `apps/web/lib/auth-context.tsx`                                      |
| "What does this API response look like?" | `packages/shared/src/api-types.ts`                                   |

---

## 9. Where to go next

- [Development Workflow](./03-development-workflow.md) — how to make a change
- [API Overview](../backend/01-api-overview.md) — the backend in detail
- [Web Overview](../frontend/01-web-overview.md) — the frontend in detail

---

## Files this document was based on

- The repository tree (`apps/`, `packages/`, `.github/`)
- `apps/api/src/app.ts`, `server.ts`, `config/env.ts`
- `apps/api/src/routes/`, `controllers/`, `db/queries/`, `db/schema.ts`
- `apps/web/app/` (folder structure), `apps/web/lib/`, `apps/web/components/`
- `apps/web/next.config.ts`
- `packages/shared/src/index.ts`, `roles.ts`
- `.gitignore`, `.github/workflows/ci.yml`, `release.yml`
