# Fastly LMS

A single-school learning platform for students, parents and teachers, run by
admins. The product rules live in [`docs/objective.md`](docs/objective.md); how
the code is split lives in [`ARCHITECTURE-REFACTOR.md`](ARCHITECTURE-REFACTOR.md).

## Repository map

```
apps/
  api/        Express 5 + TypeScript, Drizzle + PostgreSQL, Clerk backend
  web/        Next.js 16 static export (client only) + Capacitor (Android)
packages/
  shared/     zod validators, roles/status enums, API types
qa/           QA screenshots
docs/         objective.md, migration-plan.md
```

There is one database and one API that owns it. The web app never touches the
database: it renders client-side, signs in with Clerk, and calls the API with a
bearer token.

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
| `CLERK_SECRET_KEY`                  | api   | Clerk backend key                                                                                     |
| `CLERK_WEBHOOK_SIGNING_SECRET`      | api   | Signing secret of the Clerk webhook endpoint                                                          |
| `WEB_ORIGIN`                        | api   | Production web origin for CORS, comma-separated (`http://localhost:3000` and the Capacitor origins are always allowed) |
| `PORT`                              | api   | Default `4000`                                                                                        |
| `NEXT_PUBLIC_API_URL`               | web   | `http://localhost:4000/api/v1` in development, `https://student-lms-1-g0xa.onrender.com/api/v1` in production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web   | Clerk publishable key                                                                                 |

Clerk setup: set the session token claim as `{"metadata": "{{user.public_metadata}}"}`
and point the webhook at `<api host>/webhooks/clerk`.

## Database

```bash
cd apps/api
bun run db:generate   # write a migration from src/db/schema.ts (review the SQL)
bun run db:migrate    # apply migrations (needs DATABASE_URL_UNPOOLED)
bun run db:studio     # browse
```

Seeding:

```bash
cd apps/api
bun run seed:dev                    # boards, levels, subjects, courses; mirrors Clerk accounts as pending
bun run seed:super-admin you@example.com   # promotes a verified Clerk account to super_admin
```

A new sign-up is `pending` until an admin assigns a role on `/admin/requests`.
If the webhook cannot reach your machine (no tunnel), run `seed:dev` after
signing in: it creates the missing `pending` row so the request queue can see it.

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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<same Clerk instance as the API>

# Render -> Environment
WEB_ORIGIN=https://studentlms-sooty.vercel.app
DATABASE_URL=<pooled Postgres URL>
DATABASE_URL_UNPOOLED=<direct Postgres URL, for migrations>
CLERK_SECRET_KEY=<secret>
CLERK_PUBLISHABLE_KEY=<public>
CLERK_WEBHOOK_SIGNING_SECRET=<secret>
```

`apps/web/.env.production` holds the two `NEXT_PUBLIC_*` values so a local
production build (Vercel CLI or the APK) matches the deployment. Vercel's own
variables win when they are set.

CORS: `WEB_ORIGIN` is a comma-separated allowlist. The Render value must be
exactly the web origin, with no trailing slash.

## Build, lint, test

```bash
bun run build        # shared -> api -> web (web writes apps/web/out/)
bun run lint         # eslint in apps/api and apps/web
bun run lint:colors  # Nila colour gate
bun run typecheck    # tsc --noEmit in every package
bun run test         # apps/api vitest suite (needs the test database)
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
bun run build             # next build -> out/ (reads .env.production)
bun run cap:sync          # copy out/ into the native project
bun run cap:android       # open Android Studio
# or build the debug APK directly:
cd android && ./gradlew assembleDebug
```

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
- Clerk sign-in runs inside the webview; see `ARCHITECTURE-REFACTOR.md` section 6
  for what was tested.

## API

- Base path `/api/v1`; webhooks at `/webhooks/clerk` (raw body, verified by svix).
- Every response is `{ ok: true, data }` or `{ ok: false, error }` with a real
  HTTP status (400 validation, 401 unauthenticated, 403 forbidden, 404 missing,
  409 conflict).
- Role gates live in the routes; record-level ownership checks live in the
  controllers. The web's guards are UX only.
