# Fastly LMS

A single-school learning platform for students, parents and teachers, run by
admins.

## Repository map

```
apps/
  api/        Express 5 + TypeScript, Drizzle + PostgreSQL, local JWT auth
  web/        Next.js 16 (server-rendered public pages) + Capacitor (Android)
packages/
  shared/     zod validators, roles/status enums, API types
docs/         developer handbook — start at docs/00-getting-started.md
```

There is one database and one API that owns it. The web app never touches the
database: it signs in against our API and calls it with a bearer token.

## Two build targets, one source tree

```
                    Shared Next.js App
                           │
              ┌────────────┴────────────┐
              │                         │
             WEB                     MOBILE
              │                         │
      Normal Next build          Static export
              │                         │
       SSR / SSG / ISR                  out/
              │                         │
           Browser                   Capacitor
              │                         │
              └──────────┬──────────────┘
                         │
                    Existing API
```

| Command | Output | Used by |
| --- | --- | --- |
| `bun run --cwd apps/web build` | `.next/` — a normal Next build | Vercel |
| `bun run --cwd apps/web build:mobile` | `out/` — a static export | Capacitor |

The public landing page (`/`) is a **server component**, so it ships real HTML
and metadata to search engines. Every private page (`/admin`, `/student`, …)
stays a client component: it needs a session and has no SEO value.

`NEXT_TARGET=mobile` is what switches `next.config.ts` to `output: "export"`.
The application code is identical in both builds — no page checks the target.

Full explanation: [docs/frontend/05-rendering-and-builds.md](docs/frontend/05-rendering-and-builds.md).

## Install

Requires [bun](https://bun.sh) and a PostgreSQL 15+ database.

```bash
bun install
```

## Environment

Copy the examples and fill them in. Never commit real values.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

| Variable                            | Where | What                                                                                                  |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | api   | Pooled Postgres connection string                                                                     |
| `DATABASE_URL_UNPOOLED`             | api   | Used by `drizzle-kit migrate` only                                                                    |
| `AUTH_JWT_SECRET`                   | api   | Signs bearer tokens; 32+ characters, required in production                                           |
| `WEB_ORIGIN`                        | api   | Production web origin(s) for CORS, comma-separated (`http://localhost:3000` and the Capacitor origins are always allowed) |
| `WEB_APP_URL`                       | api   | Base URL used in password-reset links                                                                 |
| `RESEND_API_KEY` / `AUTH_EMAIL_FROM`| api   | Password-recovery email; empty disables recovery with a clear error                                   |
| `PORT`                              | api   | Default `4000`                                                                                        |
| `NEXT_PUBLIC_API_URL`               | web   | `http://localhost:4000/api/v1` in development, `https://student-lms-1-g0xa.onrender.com/api/v1` in production |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | seed | Read only by `bun run seed:super-admin`                                                     |

## First super admin

The seed is idempotent: it creates the account, or reconciles the existing one
in place. The password is hashed with the same scrypt helper as sign-up and is
never printed. Which database it touches is decided only by `DATABASE_URL`.

```powershell
cd apps/api
$env:SUPER_ADMIN_EMAIL="you@example.com"
$env:SUPER_ADMIN_PASSWORD="<12-128 characters>"
bun run seed:super-admin
```

Against a hosted database, load its environment first (for example from a local
file you do not commit) so `DATABASE_URL` points there. The script prints only
the database host, then creates or reconciles the row.

On Render the database variables already exist in the service environment, so
the build command is:

```bash
bun install --frozen-lockfile \
  && bun run --cwd packages/shared build \
  && bun run --cwd apps/api build \
  && bun run --cwd apps/api db:migrate
```

Seeding is **not** part of the build: a fresh clone has no `apps/api/.env`, so
the seed would fail the build after the migrations had already committed. Run it
once from the Render Shell instead:

```bash
bun run --cwd apps/api seed:super-admin
```

Do not pass `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` inline before the
command (as in `cd apps/api SUPER_ADMIN_EMAIL=... bun run seed:super-admin`): a
`VAR=value` word placed after a path turns into a second argument for `cd`, and
the shell fails with `cd: too many arguments` after the migrations have
already run. Set them in the Render dashboard instead. Every further step must
use `--cwd` from the repository root, because each command in a chained
`&&` sequence runs in a fresh shell.

## Database

```bash
cd apps/api
bun run db:generate   # write a migration from src/db/schema.ts (review the SQL)
bun run db:migrate    # apply migrations (needs DATABASE_URL_UNPOOLED)
bun run db:studio     # browse
```

Seeding:

```bash
# Safe to re-run; adds the Pakistani starter catalogue without duplicating rows.
bun run --cwd apps/api seed:catalog

# Sign up with this email on the website first, then run this once in Render Shell.
bun run --cwd apps/api seed:super-admin <your-registered-email>
```

The catalogue seed adds five exam-board entries, seven levels, fourteen core
subjects and the corresponding SSC, HSSC and Cambridge course combinations.
It is idempotent and leaves existing course combinations untouched.

The super-admin seed creates the account if the email is new, or reconciles the
existing one in place: it sets the role to `super_admin`, activates it, sets the
password and bumps `session_version` so older tokens stop working. After running
it, sign out and sign in again.


## Run

```bash
# API
cd apps/api && bun run dev          # http://localhost:4000, GET /api/v1/health

# Web
cd apps/web && bun run dev          # http://localhost:3000
```

From the repository root: `bun run dev:api` and `bun run dev:web`.

## Deployment

| Part | Host | Notes |
| --- | --- | --- |
| Web | Vercel — `https://studentlms-sooty.vercel.app` | Static export from `apps/web` |
| API | Render — `https://student-lms-1-g0xa.onrender.com` | Express, base path `/api/v1` |
| Android | Capacitor, `apps/web/android` | Bundles `apps/web/out/` locally |

Environment variables (values for secrets are never in the repository):

```
# Vercel -> Project Settings -> Environment Variables (Production)
NEXT_PUBLIC_API_URL=https://student-lms-1-g0xa.onrender.com/api/v1

# Render -> Environment
WEB_ORIGIN=https://studentlms-sooty.vercel.app
DATABASE_URL=<pooled Postgres URL>
DATABASE_URL_UNPOOLED=<direct Postgres URL, for migrations>
AUTH_JWT_SECRET=<32+ random characters>
WEB_APP_URL=https://studentlms-sooty.vercel.app
RESEND_API_KEY=<secret>          # optional: enables password recovery
AUTH_EMAIL_FROM=<verified sender> # optional
```

`apps/web/.env.production` holds the `NEXT_PUBLIC_API_URL` value so a local
production build (Vercel CLI or the APK) matches the deployment. Vercel's own
variables win when they are set.

CORS: `WEB_ORIGIN` is a comma-separated allowlist. The Render value must be
exactly the web origin, with no trailing slash.

## Build, lint, test

```bash
bun run build        # shared -> api -> web (normal Next build, for Vercel)
bun run lint         # eslint in apps/api and apps/web
bun run lint:colors  # Nila colour gate
bun run typecheck    # tsc --noEmit in every package
bun run test         # apps/api vitest suite (needs the test database)

# Mobile: static export into apps/web/out/, then wrap it
bun run --cwd apps/web build:mobile
bun run --cwd apps/web cap:sync
```

Tests need a throwaway Postgres:

```bash
docker run -d --name lms-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
  -e POSTGRES_DB=lms_test -p 5434:5432 postgres:15
cd apps/api && bun run db:migrate --  # with DATABASE_URL_UNPOOLED=postgres://test:test@localhost:5434/lms_test
bun run test
```

`TEST_DATABASE_URL` overrides the default `postgres://test:test@localhost:5434/lms_test`.

## Mobile (Android)

The Capacitor project lives in `apps/web/android`, wrapping the static export.

```bash
cd apps/web
bun run build:mobile      # static export -> out/ (NEXT_TARGET=mobile)
bun run cap:sync          # copy out/ into the native project
bun run cap:android       # open Android Studio
# or build the debug APK directly:
cd android && ./gradlew assembleDebug
```

> `bun run build` (without `:mobile`) produces a **server** build for the web
> and does not write `out/`. Capacitor needs the static export, so always use
> `build:mobile` before `cap:sync`.

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
Install it on a running emulator or device with `adb install -r <apk>`.

Release builds need `apps/web/android/key.properties` plus the keystore it
points at. Without them `assembleRelease` produces an unsigned APK that cannot
be installed.

Notes:

- `androidScheme: "https"` makes the webview origin `https://localhost`, which
  the API allows through CORS.
- `NEXT_PUBLIC_API_URL` is baked in at build time, so the APK talks to the
  same Render API as the web build. For an emulator against a *local* API, use
  `http://10.0.2.2:4000/api/v1` — `localhost` on an emulator is the device itself.
- Sign-in runs inside the webview against the API's `/auth/sign-in` route, which
  issues the bearer token the export stores.

## API

- Base path `/api/v1`. Authentication is a bearer JWT from `/auth/sign-in`.
- Every response is `{ ok: true, data }` or `{ ok: false, error }` with a real
  HTTP status (400 validation, 401 unauthenticated, 403 forbidden, 404 missing,
  409 conflict).
- Role gates live in the routes; record-level ownership checks live in the
  controllers. The web's guards are UX only.
