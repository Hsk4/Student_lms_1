# Project Overview

**Purpose:** build a mental model of the whole application — what the pieces
are, why they are separate, and how a request travels from a click to a
database row and back.

Read this before touching code. It is the map; the other documents are the
territory.

---

## 1. What this application is

**Fastly LMS** is a learning management system for a **single school**. It has
five kinds of user:

| Role          | What they do                                                                   |
| ------------- | ------------------------------------------------------------------------------ |
| `super_admin` | Runs the platform. Can manage every account, including other admins.           |
| `admin`       | Runs the school office: approves requests, manages the catalogue, users, fees. |
| `teacher`     | Teaches classes, takes attendance, sets assignments, grades, meets parents.    |
| `student`     | Joins classes, submits work, sees attendance, fees and materials.              |
| `parent`      | Watches their linked child's progress, attendance and fees.                    |

There is no multi-school tenancy. One deployment serves one school.

---

## 2. The architecture

```text
        User (browser or Android app)
                 │
                 │  clicks, types
                 ▼
        ┌─────────────────────┐
        │   Next.js web app   │   apps/web
        │   (runs in the      │   React components, no server
        │    browser only)    │
        └─────────────────────┘
                 │
                 │  fetch() with  Authorization: Bearer <token>
                 │  JSON in, JSON out
                 ▼
        ┌─────────────────────┐
        │    Express API      │   apps/api
        │                     │
        │  ┌───────────────┐  │
        │  │ Authentication│  │   who is this?
        │  ├───────────────┤  │
        │  │ Authorization │  │   may they do this?
        │  ├───────────────┤  │
        │  │  Validation   │  │   is the input well-formed?
        │  ├───────────────┤  │
        │  │ Business logic│  │   controllers/
        │  └───────────────┘  │
        └─────────────────────┘
                 │
                 │  Drizzle ORM (typed SQL)
                 ▼
        ┌─────────────────────┐
        │     PostgreSQL      │   one database
        └─────────────────────┘
```

### The one rule that explains everything

> **The web app never talks to the database.**

It has no database driver, no connection string, and no SQL. Every piece of
data it shows came from an HTTP call to the API. This is why:

- you must run **two** processes locally;
- the API is the only place that can enforce permissions;
- a bug in the frontend can never corrupt data.

---

## 3. The three packages

### `apps/api` — the backend

An **Express 5** server written in TypeScript. It owns the database and is the
only thing that can read or write it.

| Responsibility                           | Where                                |
| ---------------------------------------- | ------------------------------------ |
| Start the server, load config            | `src/server.ts`, `src/config/env.ts` |
| Build the Express app, CORS, rate limits | `src/app.ts`                         |
| Define URL paths                         | `src/routes/`                        |
| Decide what each endpoint does           | `src/controllers/`                   |
| Talk to the database                     | `src/db/queries/`                    |
| Table definitions                        | `src/db/schema.ts`                   |
| Login, roles, permissions                | `src/middleware/auth.ts`             |
| Turn errors into JSON                    | `src/middleware/error-handler.ts`    |

### `apps/web` — the frontend

A **Next.js 16** app that is **statically exported** (`output: "export"` in
`next.config.ts`). That means `next build` produces a folder of plain HTML, CSS
and JavaScript in `apps/web/out/`, which can be served by any static host.

There is **no Next.js server** in production. No server components read a
session, no route handlers, no middleware. Everything runs in the browser.

The same `out/` folder is also wrapped by **Capacitor** to produce the Android
app, so the web and mobile builds share one codebase.

### `packages/shared` — the contract

A small package imported by **both** the API and the web app. It holds the
things that must agree on both sides:

| File           | Contains                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `roles.ts`     | The list of roles and statuses, and `homeFor()` — the one function that decides where an account may land |
| `validators/`  | Zod schemas that validate request bodies                                                                  |
| `api-types.ts` | TypeScript types describing API responses                                                                 |

> **Why a shared package?** If the API says a role is `"super_admin"` and the
> web app checks for `"superadmin"`, nothing catches it until runtime. Sharing
> the type means the compiler catches it instead.

---

## 4. How a request actually travels

Here is a real example: **an admin approves a student's access request.**

```text
1. Admin clicks "Approve"
        │
        ▼
2. apps/web/app/admin/requests/request-actions.tsx
   calls api.post("/admin/requests/<id>/decision", { decision: "approve", role: "student" })
        │
        ▼
3. apps/web/lib/api-client.ts
   reads the token from localStorage, adds "Authorization: Bearer <token>",
   sends fetch() to https://<api>/api/v1/admin/requests/<id>/decision
        │
        ▼
4. apps/api/src/app.ts
   CORS check → rate limit → route matching
        │
        ▼
5. apps/api/src/routes/admin.ts
   auth()            → is the token valid? who is it?
   requireRole(...)  → is this user an admin or super_admin?
        │
        ▼
6. apps/api/src/controllers/admin-users.ts  → decideAccessRequest()
   Zod validates the body
   business rules: can this admin manage this user?
        │
        ▼
7. apps/api/src/db/queries/access-requests.ts
   Drizzle builds the SQL
        │
        ▼
8. PostgreSQL
   UPDATE access_requests SET state = 'approved' ...
   UPDATE users SET role = 'student', status = 'active' ...
   INSERT INTO audit_logs ...
        │
        ▼
9. Response travels back
   { ok: true, data: null }
        │
        ▼
10. apps/web
    the page calls its own reload() and the list refreshes
```

Every feature in this application follows this same shape. Once you can follow
this one, you can follow all of them.

---

## 5. Authentication in one paragraph

Users sign in with **email and password** against `POST /api/v1/auth/sign-in`.
The API checks the password against a scrypt hash in the `users` table and
returns a **JWT** signed with `AUTH_JWT_SECRET`. The browser stores that token
in `localStorage` and sends it as `Authorization: Bearer <token>` on every
request. The API verifies the signature, loads the user row, and attaches it to
the request. **The database row — not the token — is the authority on role and
status.**

Full detail: [Authentication](../features/authentication.md).

---

## 6. Roles and the approval workflow

This is the part newcomers most often get wrong, so it is worth stating plainly:

```text
Anyone can sign up  ──▶  account exists, status = "pending", role = null
                              │
                              │  they fill in the request form
                              ▼
                        access_requests row (state = "open")
                              │
                              │  an admin approves it
                              ▼
                        role assigned, status = "active"
                              │
                              ▼
                        they land in their panel
```

| Role          | How it is obtained                                                    |
| ------------- | --------------------------------------------------------------------- |
| `super_admin` | Only by the seed script, or by another super admin                    |
| `admin`       | Only by a super admin                                                 |
| `teacher`     | Sign up → request → admin approves                                    |
| `student`     | Sign up → request → admin approves → **then** link a parent           |
| `parent`      | Sign up → request → admin approves → **then** redeem the child's code |

Two special cases:

- **A role is the approval.** An account that already has a role is not held at
  the gate, even if its status is still `pending`. This is what lets the seeded
  super admin in.
- **A student is not finished until a parent is linked.** Until then, every
  student endpoint returns `403` and the app sends them to
  `/onboarding/parent`.

---

## 7. What each top-level folder is for

| Folder              | What it is                                           | Do you edit it?                  |
| ------------------- | ---------------------------------------------------- | -------------------------------- |
| `apps/api`          | The backend                                          | Yes — for any server-side change |
| `apps/web`          | The frontend                                         | Yes — for any UI change          |
| `packages/shared`   | Types and validators used by both                    | Yes — when a rule must be shared |
| `brand-kit`         | Design assets: logos, colours, reference screenshots | Rarely — design reference only   |
| `docs`              | This documentation                                   | Yes — keep it current            |
| `.github/workflows` | CI and the release pipeline                          | When build/deploy changes        |

> **Note:** the root `README.md` still lists a `qa/` folder for screenshots.
> That folder no longer exists in the repository; the README is out of date on
> this point.

---

## 8. Technology choices, and why

| Choice                    | Why it appears to be used                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**                   | One tool for install, scripts and running TypeScript. The lockfile is `bun.lock`.                                                |
| **Express 5**             | Small, explicit routing. Every route is visible in `src/routes/`.                                                                |
| **Drizzle ORM**           | Typed SQL. The schema in `src/db/schema.ts` is the single source of truth, and migrations are generated from it.                 |
| **PostgreSQL**            | Relational data with real constraints (unique keys, foreign keys, CHECKs) doing work the application would otherwise have to do. |
| **Next.js static export** | The same build serves the website and the Android webview. No server to run or pay for.                                          |
| **JWT in localStorage**   | Simple, works identically in a browser and a Capacitor webview.                                                                  |
| **Zod**                   | One schema validates a request and produces its TypeScript type.                                                                 |

> The repository uses these approaches, but the original design reasons are not
> documented anywhere in it. The table above is an interpretation based on how
> the code is written.

---

## 9. What this application does _not_ have

Worth knowing early, so you do not go looking for it:

- **No server-side rendering.** Every page is client-rendered.
- **No global data cache.** Each page fetches what it needs and reloads itself
  after a change (see [Web Overview](../frontend/01-web-overview.md)).
- **No file uploads.** Materials and books store a URL, not a file.
- **No real-time updates.** The pending page polls every 5 seconds; nothing else
  is live.
- **No multi-school support.** One deployment, one school.
- **No email except password recovery.** Everything else is in-app.

---

## 10. Where to go next

| You want to…                          | Read                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| Know what every folder and file is    | [Project Structure](./02-project-structure.md)       |
| Make a change without breaking things | [Development Workflow](./03-development-workflow.md) |
| Work on the server                    | [API Overview](../backend/01-api-overview.md)        |
| Work on the UI                        | [Web Overview](../frontend/01-web-overview.md)       |
| Understand the tables                 | [Database](../backend/04-database.md)                |
| Understand login and roles            | [Authentication](../features/authentication.md)      |

---

## Files this document was based on

- `README.md`
- `apps/api/src/app.ts` — middleware order, route mounting
- `apps/api/src/server.ts` — startup
- `apps/api/src/routes/*.ts` — the URL surface
- `apps/api/src/controllers/*.ts` — business logic
- `apps/api/src/db/schema.ts` — tables
- `apps/api/src/middleware/auth.ts` — the gate
- `apps/api/src/lib/respond.ts`, `lib/http-error.ts` — the response contract
- `packages/shared/src/roles.ts` — roles, statuses, `homeFor()`
- `apps/web/lib/api-client.ts` — how the browser calls the API
- `apps/web/next.config.ts` — static export
- `apps/web/app/admin/requests/request-actions.tsx` — the worked example
