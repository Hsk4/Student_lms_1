# Getting Started

**Purpose:** get this project running on your machine, from a fresh clone to a
signed-in admin panel, and know what to do when a step fails.

If you only read one document, read this one. It assumes you have never seen
this repository before.

---

## 1. What you are about to run

This repository contains **two applications** and **one shared package**:

| Part              | What it is                                                     | Runs on                 |
| ----------------- | -------------------------------------------------------------- | ----------------------- |
| `apps/api`        | The backend. An Express server that owns the database.         | `http://localhost:4000` |
| `apps/web`        | The frontend. A Next.js app that runs entirely in the browser. | `http://localhost:3000` |
| `packages/shared` | Types and validation rules used by **both**.                   | (not run — imported)    |

You need **both** running at the same time. The web app is useless on its own:
it has no database and no server of its own. It asks the API for everything.

```text
Browser (localhost:3000)  ──HTTP──▶  API (localhost:4000)  ──▶  PostgreSQL
```

---

## 2. Prerequisites

Install these before you start.

| Tool                       | Why                                                                         | Check it works   |
| -------------------------- | --------------------------------------------------------------------------- | ---------------- |
| **Bun** (1.4.x)            | The package manager and script runner for the whole repo                    | `bun --version`  |
| **PostgreSQL 15 or newer** | The database. 15+ is required because the schema uses `NULLS NOT DISTINCT`. | `psql --version` |
| **Git**                    | To clone the repository                                                     | `git --version`  |

Optional, only if you need them:

| Tool                        | When you need it                                                             |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Docker**                  | Easiest way to get a throwaway Postgres for running tests                    |
| **Android Studio + JDK 21** | Only for building the Android app                                            |
| **Node.js**                 | Not required — the repo uses Bun. Some tools (`npx serve`) assume it exists. |

> **Why Bun and not npm?** The repository has a `bun.lock` lockfile and a
> `packageManager: "bun@1.4.4"` field in the root `package.json`. The build
> command used in deployment runs `bun install --frozen-lockfile`, which fails
> with npm or yarn. Use Bun.

---

## 3. Clone and install

```bash
git clone https://github.com/Hsk4/Student_lms_1.git
cd Student_lms_1
bun install
```

`bun install` at the **repository root** installs dependencies for every
workspace (`apps/api`, `apps/web`, `packages/shared`) in one go. You do not need
to run it inside each folder.

---

## 4. Create the environment files

The repository ships **examples**, not real values. Copy them:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

### What goes in `apps/api/.env`

| Variable                             | Required?             | What it does                                                            |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                       | **Yes**               | The Postgres connection string the API uses at runtime.                 |
| `DATABASE_URL_UNPOOLED`              | For migrations        | A direct (non-pooled) connection. Migrations need it; the app does not. |
| `AUTH_JWT_SECRET`                    | **Yes in production** | Signs the login tokens. Must be 32+ characters.                         |
| `PORT`                               | No                    | Defaults to `4000`.                                                     |
| `WEB_ORIGIN`                         | Production only       | Which web addresses may call the API (CORS).                            |
| `WEB_APP_URL`                        | Optional              | Used to build password-reset links.                                     |
| `RESEND_API_KEY` / `AUTH_EMAIL_FROM` | Optional              | Enables password-recovery email. Leave empty to disable it.             |

A minimal local file looks like this:

```dotenv
DATABASE_URL="postgres://postgres:postgres@localhost:5432/lms"
DATABASE_URL_UNPOOLED="postgres://postgres:postgres@localhost:5432/lms"
AUTH_JWT_SECRET="a-local-secret-at-least-32-characters-long"
```

> **Why two database URLs?** A hosted Postgres (Neon, Supabase) gives you a
> _pooled_ address for the app and a _direct_ address for admin work. Migrations
> create tables and need a real session, which a-mode pooler cannot
> hold. Locally both can be the same string.

### What goes in `apps/web/.env.local`

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
```

That is the only variable the web app needs. It tells the browser where the API
lives.

> **Important:** `NEXT_PUBLIC_*` variables are **baked into the JavaScript at
> build time**, not read at runtime. If you change this value you must restart
> (or rebuild) the web app. This is the single most common source of confusion
> in this project — see [Troubleshooting](#9-troubleshooting).

---

## 5. Create the database

Create an empty database. With a local Postgres:

```bash
createdb lms
```

Or with Docker (this is also what the test suite expects):

```bash
docker run -d --name lms-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=lms \
  -p 5432:5432 postgres:15
```

Then point `DATABASE_URL` at it.

---

## 6. Apply migrations

Migrations are the SQL files that create the tables. They live in
`apps/api/src/db/migrations/`.

```bash
bun run --cwd apps/api db:migrate
```

You should see `Migrations applied.`

> **Why `--cwd`?** The script must run from inside `apps/api` so it finds
> `drizzle.config.ts`. `bun run --cwd apps/api <script>` does that from the
> repository root, which is why every command in this documentation uses it.

If this fails, the API cannot work at all — every request will return a
database error. Fix it before continuing.

---

## 7. Create your first account

A brand-new database has **no users**. Nobody can sign in, and there is no
"register as admin" button — by design.

There are two ways in:

### Option A — the super-admin seed (recommended)

This creates a fully privileged account directly.

```bash
# PowerShell
$env:SUPER_ADMIN_EMAIL="you@example.com"
$env:SUPER_ADMIN_PASSWORD="a-password-of-12-to-128-characters"
bun run --cwd apps/api seed:super-admin
```

```bash
# bash / zsh
SUPER_ADMIN_EMAIL="you@example.com" \
SUPER_ADMIN_PASSWORD="a-password-of-12-to-128-characters" \
bun run --cwd apps/api seed:super-admin
```

The script prints the database host and then `Created the account.` It never
prints the password. Running it again with the same email **updates** that
account instead of creating a duplicate.

> **Note:** the root `README.md` says this seed "does not create an account".
> That is out of date — `apps/api/scripts/seed-super-admin.ts` inserts the row
> when the email is not found (line 101) and logs `Created the account.` The
> script is the source of truth.

### Option B — sign up, then promote

1. Start both apps (next section).
2. Open `http://localhost:3000/sign-up` and create an account.
3. Run the seed with that same email — it will promote the existing account to
   `super_admin` rather than create a second one.

> **Why is there no admin sign-up?** Roles are granted, never self-assigned.
> See [Authentication](../features/authentication.md) for the full rule.

---

## 8. Start the applications

Open **two terminals**.

**Terminal 1 — the API:**

```bash
bun run dev:api
```

Wait for `[api] listening on http://localhost:4000`. Check it:

```bash
curl http://localhost:4000/api/v1/health
# {"ok":true,"data":{"status":"ok"}}
```

**Terminal 2 — the web app:**

```bash
bun run dev:web
```

Open `http://localhost:3000` and sign in with the account from step 7.

> **Start the API first.** The web app loads fine without it, but every screen
> will show a connection error, and sign-in will fail with
> _"Cannot reach the school server"_.

---

## 9. Optional: load the starter catalogue

The request form asks students to pick a board, level and subjects. On a fresh
database those lists are **empty**, and the form says _"The catalog is empty"_.

Fill them with the Pakistani starter catalogue:

```bash
bun run --cwd apps/api seed:catalog
```

This adds 5 boards, 7 levels, 14 subjects and the matching course combinations.
It is safe to run repeatedly — it never duplicates rows.

There is also a plain SQL version at `apps/api/src/db/seed-catalog.sql` if you
prefer to paste it into a database console.

---

## 10. Everyday commands

Run these from the **repository root**.

| Command                              | What it does                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `bun run dev:api`                    | Start the API with auto-reload                                 |
| `bun run dev:web`                    | Start the web app with hot reload                              |
| `bun run typecheck`                  | Type-check all three packages. **Run this before committing.** |
| `bun run lint`                       | Lint the API and the web app                                   |
| `bun run test`                       | Run the API test suite (needs a test database — see below)     |
| `bun run build`                      | Build shared → API → web, in that order                        |
| `bun run --cwd apps/api db:generate` | Create a new migration after editing the schema                |
| `bun run --cwd apps/api db:migrate`  | Apply pending migrations                                       |
| `bun run --cwd apps/api db:studio`   | Open a browser UI to browse the database                       |

### Running the tests

The tests need their **own** database — they wipe it between tests, so never
point them at your development data.

```bash
docker run -d --name lms-test-db \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=lms_test \
  -p 5434:5432 postgres:15

# create the tables in it
DATABASE_URL="postgres://test:test@localhost:5434/lms_test" \
DATABASE_URL_UNPOOLED="postgres://test:test@localhost:5434/lms_test" \
bun run --cwd apps/api db:migrate

bun run test
```

The suite defaults to `postgres://test:test@localhost:5434/lms_test`. Override
it with `TEST_DATABASE_URL` if your setup differs.

---

## 11. Troubleshooting

### "Cannot reach the school server at http://localhost:4000/api/v1"

**Cause:** the API is not running, or it crashed on startup.
**Check:** look at Terminal 1. If it exited, the message above it says why —
usually a missing `DATABASE_URL`.
**Fix:** start the API, or fix the environment file.

### The API exits immediately with `Invalid environment variables: DATABASE_URL`

**Cause:** `apps/api/.env` is missing or empty.
**Fix:** copy `apps/api/.env.example` to `apps/api/.env` and fill it in.

### Sign-in returns 401 for a password you know is correct

**Cause:** the account does not exist in _this_ database, or you are pointed at
a different database than you think.
**Check:** `bun run --cwd apps/api db:studio` and look at the `users` table.
**Fix:** run the super-admin seed (step 7).

### Sign-in returns 429 "Too many authentication attempts"

**Cause:** the API allows 10 sign-in attempts per 15 minutes per IP address.
**Fix:** wait, or set `AUTH_ATTEMPT_LIMIT` in `apps/api/.env` while developing.

### The web app calls the wrong API address

**Cause:** `NEXT_PUBLIC_API_URL` is baked in at build time. Changing
`.env.local` does nothing until the dev server restarts.
**Fix:** stop the web app, start it again. For a production build, rebuild.

### "The catalog is empty" on the request form

**Cause:** the `boards`, `levels` and `subjects` tables have no rows.
**Fix:** `bun run --cwd apps/api seed:catalog`.

### `bun install --frozen-lockfile` fails with "lockfile had changes"

**Cause:** someone edited a `package.json` without committing the updated
`bun.lock`.
**Fix:** run `bun install` (without `--frozen-lockfile`) and commit `bun.lock`.

### Migrations fail with a connection error

**Cause:** the database is unreachable — wrong host, wrong password, or a
hosted database that has not allow-listed your IP.
**Check:** `bun run --cwd apps/api db:studio`. If that also fails, the problem
is the connection string, not the migrations.
**Note:** `db:migrate` retries a few times on connection errors before giving
up, so a slow-starting database is usually fine.

---

## 12. Where to go next

| You want to…                           | Read                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| Understand how the pieces fit together | [Project Overview](./01-project-overview.md)         |
| Know what every folder is for          | [Project Structure](./02-project-structure.md)       |
| Make your first change safely          | [Development Workflow](./03-development-workflow.md) |
| Understand login and roles             | [Authentication](../features/authentication.md)      |
| Work on the backend                    | [API Overview](../backend/01-api-overview.md)        |
| Work on the frontend                   | [Web Overview](../frontend/01-web-overview.md)       |

---

## Files this document was based on

- `README.md`
- `package.json`, `apps/api/package.json`, `apps/web/package.json`
- `apps/api/.env.example`, `apps/web/.env.example`
- `apps/api/src/config/env.ts` (which variables are required)
- `apps/api/src/server.ts`, `apps/api/src/app.ts` (startup and health route)
- `apps/api/scripts/seed-super-admin.ts`, `apps/api/scripts/seed-catalog.ts`
- `apps/api/scripts/db-migrate.ts` (the retry behaviour)
- `apps/api/src/routes/me.ts` (the 10-per-15-minutes sign-in limit)
