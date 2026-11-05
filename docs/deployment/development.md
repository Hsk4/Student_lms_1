# Development Environment

**Purpose:** the local setup in one place — what runs, on which port, and how to
reset it when it breaks.

For a first-time setup, read [Getting Started](../00-getting-started.md) first.

---

## 1. What runs locally

```text
┌─────────────────────┐        ┌─────────────────────┐
│  Web (Next.js)      │  HTTP  │  API (Express)      │
│  localhost:3000     │───────▶│  localhost:4000     │
└─────────────────────┘        └──────────┬──────────┘
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │  PostgreSQL         │
                               │  localhost:5432     │
                               └─────────────────────┘
```

Two terminals, two processes. The web app cannot work without the API.

---

## 2. Starting

```bash
# terminal 1
bun run dev:api      # http://localhost:4000

# terminal 2
bun run dev:web      # http://localhost:3000
```

Check the API is alive:

```bash
curl http://localhost:4000/api/v1/health
# {"ok":true,"data":{"status":"ok"}}
```

---

## 3. Environment files

| File                  | Read by     | Contains                             |
| --------------------- | ----------- | ------------------------------------ |
| `apps/api/.env`       | The API     | `DATABASE_URL`, `AUTH_JWT_SECRET`, … |
| `apps/web/.env.local` | The web app | `NEXT_PUBLIC_API_URL`                |

Both are git-ignored. Copy them from the `.env.example` files.

> **`NEXT_PUBLIC_*` is baked in at build time.** Changing `.env.local` needs a
> dev-server restart.

---

## 4. The database

### A local Postgres

```bash
createdb lms
```

```dotenv
DATABASE_URL="postgres://postgres:postgres@localhost:5432/lms"
DATABASE_URL_UNPOOLED="postgres://postgres:postgres@localhost:5432/lms"
```

### Docker

```bash
docker run -d --name lms-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=lms \
  -p 5432:5432 postgres:15
```

### Migrate and seed

```bash
bun run --cwd apps/api db:migrate
bun run --cwd apps/api seed:catalog
```

### Browse it

```bash
bun run --cwd apps/api db:studio
```

---

## 5. The test database

Tests wipe their database between cases, so they need their **own**.

```bash
docker run -d --name lms-test-db \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=lms_test \
  -p 5434:5432 postgres:15

DATABASE_URL="postgres://test:test@localhost:5434/lms_test" \
DATABASE_URL_UNPOOLED="postgres://test:test@localhost:5434/lms_test" \
bun run --cwd apps/api db:migrate

bun run test
```

`TEST_DATABASE_URL` overrides the default.

---

## 6. Useful local overrides

| Variable                   | Why                                                 |
| -------------------------- | --------------------------------------------------- |
| `AUTH_ATTEMPT_LIMIT=10000` | Sign-in allows 10 per 15 min; a test run needs more |
| `RATE_LIMIT_MAX=10000`     | The global 300/min limit                            |
| `PORT=4001`                | If 4000 is taken                                    |

Set them in `apps/api/.env` — they are read at startup.

---

## 7. Resetting

### Reset the database

```bash
bun run --cwd apps/api db:migrate   # idempotent
bun run --cwd apps/api seed:catalog
```

To start completely fresh, drop and recreate the database, then migrate.

### Reset the browser session

The token lives in `localStorage` under `lms-auth-token`. In DevTools:

```js
localStorage.clear();
```

### Clear the build cache

```bash
rm -rf apps/web/.next apps/web/out apps/api/dist
```

---

## 8. Common problems

| Symptom                                                  | Cause                                           | Fix                                                                |
| -------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| "Cannot reach the school server"                         | API not running                                 | Start it                                                           |
| API exits: `Invalid environment variables: DATABASE_URL` | No `.env`                                       | Copy the example                                                   |
| Sign-in 401                                              | The account is not in this database             | Run the seed                                                       |
| Sign-in 429                                              | 10 attempts in 15 min                           | Wait, or raise `AUTH_ATTEMPT_LIMIT`                                |
| "blocked by CORS policy"                                 | The origin is not allowed                       | `localhost:3000` is allowed in development only — check `NODE_ENV` |
| The web app calls the wrong API                          | `NEXT_PUBLIC_API_URL` changed without a restart | Restart the dev server                                             |
| "The catalog is empty"                                   | No catalogue rows                               | `seed:catalog`                                                     |
| Tests fail on a missing table                            | The test database is not migrated               | Migrate it (step 5)                                                |

---

## 9. Related

- [Getting Started](../00-getting-started.md)
- [Production](./production.md)
- [Debugging](../guides/debugging.md)

---

## Files this document was based on

- `package.json`, `apps/api/package.json`, `apps/web/package.json`
- `apps/api/.env.example`, `apps/web/.env.example`
- `apps/api/src/config/env.ts`
- `apps/api/src/app.ts` — the development CORS origins
- `apps/api/tests/helpers.ts` — the test database
