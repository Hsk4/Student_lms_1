# API Overview

**Purpose:** understand how the backend is put together — how a request enters,
which layer handles it, and what every response looks like.

---

## 1. What the API is

An **Express 5** server in TypeScript. It is the only thing in the system that
can read or write the database.

- Base path: **`/api/v1`**
- Default port: **4000**
- Health check: `GET /api/v1/health`

---

## 2. Startup, in order

```text
bun run dev
   │
   ▼
src/server.ts
   ├── loadEnv()          validate environment variables (fail fast)
   ├── createApp()        build the Express app
   └── app.listen(PORT)   start accepting requests
```

`server.ts` is deliberately tiny:

```ts
const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
```

> **Why split `server.ts` from `app.ts`?** Tests import `createApp()` and drive
> it with supertest — no port, no socket, no shutdown handling. Only the real
> process needs those.

### Environment validation

`src/config/env.ts` parses every variable with Zod **once, at startup**. A
missing `DATABASE_URL` stops the process immediately with the variable _name_ —
never its value.

In production it additionally requires `AUTH_JWT_SECRET` to be at least 32
characters.

---

## 3. The middleware stack

Every request passes through these, in this order (`src/app.ts`):

```text
1. helmet()              security headers
2. cors(...)             is this origin allowed?
3. express.json()        parse the JSON body (256 kB limit)
4. rateLimit()           300 requests / minute / IP
5. routes                /api/v1/...
6. notFoundHandler       404 for anything unmatched
7. errorHandler          turns every thrown error into JSON
```

### CORS

`corsOrigins()` builds the allow-list from:

| Source                                       | When                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `WEB_ORIGIN`                                 | Always — comma-separated production origins    |
| `PREVIEW_ORIGIN_PATTERNS`                    | Always — wildcard matchers for Vercel previews |
| `http://localhost:3000`, `:5173`, `:3100`    | **Development only**                           |
| `https://localhost`, `capacitor://localhost` | Always — the Android/iOS webview               |

An origin that is not on the list gets **no** `Access-Control-Allow-Origin`
header, so the browser blocks the response. The server still answers; the
browser discards it.

> **This is the most common "the API is broken" report.** If the browser console
> says _"blocked by CORS policy"_, the fix is in `WEB_ORIGIN`, not in the code.

---

## 4. The four layers

```text
routes/          "which URL, which guards, which controller"
    │
    ▼
controllers/     "validate, check permissions, decide, call queries"
    │
    ▼
db/queries/      "the SQL"
    │
    ▼
db/schema.ts     "the tables"
```

### A real route

`src/routes/admin.ts`:

```ts
const admin = [auth(), requireRole("admin", "super_admin")];

adminRoutes.get(
  "/admin/users",
  ...admin,
  asyncHandler(async (req, res) => ok(res, await listUsersAdmin(req))),
);
```

Read it as: _"for `GET /admin/users`, require a valid token and an admin role,
then run `listUsersAdmin` and wrap the result in `{ ok: true, data }`."_

### A real controller

`src/controllers/admin-users.ts`:

```ts
export async function listUsersAdmin(req: Request) {
  const actor = actorAdmin(req);          // the signed-in admin
  const query = listUsersQuerySchema.parse(req.query);   // validate
  const [users, total] = await Promise.all([...]);       // query
  return { users, total, page, pageCount, counts };      // shape
}
```

### A real query

`src/db/queries/users.ts` — plain Drizzle, no HTTP:

```ts
const rows = await conn
  .select()
  .from(users)
  .where(eq(users.role, role))
  .orderBy(desc(users.createdAt));
```

> **Why this split?** A query can be reused by several endpoints, a seed script
> and a test. Keeping it free of `req`/`res` is what makes that possible.

---

## 5. The response contract

**Every** response is one of two shapes.

### Success

```json
{ "ok": true, "data": { ... } }
```

Written by one helper, `src/lib/respond.ts`:

```ts
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}
```

### Failure

```json
{ "ok": false, "error": "An account with that email already exists." }
```

With a real HTTP status:

| Status | Meaning                                                         | Thrown by                                |
| ------ | --------------------------------------------------------------- | ---------------------------------------- |
| `400`  | Bad input                                                       | Zod validation, `badRequest()`           |
| `401`  | Not signed in, or the token is invalid/expired                  | `unauthorized()`                         |
| `403`  | Signed in, but not allowed (wrong role, pending, not onboarded) | `forbidden()`, `notReady()`              |
| `404`  | Not found                                                       | `notFound()`                             |
| `409`  | Conflicts with existing data                                    | `conflict()`, Postgres unique violations |
| `500`  | Unexpected server error                                         | anything else                            |

> **Why one envelope?** The web client has exactly one place that unwraps a
> response (`lib/api-client.ts`). It never has to guess whether a body is data
> or an error.

---

## 6. Error handling

Controllers **throw**; they never write an error response themselves.

```ts
if (!user) throw notFound("User not found");
if (!canManage(actor.role, user.role))
  throw forbidden("You cannot change this user");
```

`src/middleware/error-handler.ts` catches everything and decides the status:

| Error type               | Status         | Message                                |
| ------------------------ | -------------- | -------------------------------------- |
| `ZodError`               | 400            | The validation messages, joined        |
| `HttpError`              | its own status | its own message                        |
| `SyntaxError` (bad JSON) | 400            | "Invalid JSON body"                    |
| Postgres error           | 409            | A friendly message from `messageFor()` |
| Anything else            | 500            | The error's message                    |

Postgres errors are **classified**, never leaked. A failed insert throws
`Failed query: insert into "users" ...`, which must never reach a client, so
`messageFor()` maps the error code to a sentence:

```ts
if (isUniqueViolation(error)) {
  if (constraint.startsWith("users_")) return "An account with that email already exists.";
  ...
}
```

> **Why `asyncHandler`?** It wraps an async controller so a rejected promise
> reaches `next(error)` and therefore the error handler. Without it, a thrown
> error in an async function becomes an unhandled rejection and the request
> hangs.

---

## 7. Validation

Two places validate, for two different reasons.

| Where                                                  | What                                | Why                                                    |
| ------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------ |
| `packages/shared/src/validators/`                      | Zod schemas                         | Shared with the web app, so the form and the API agree |
| `src/middleware/error-handler.ts` → `validate(schema)` | A middleware that parses `req.body` | Rejects bad input before the controller runs           |

Most controllers call `.parse()` directly instead of using the middleware, so
the parsed value is typed:

```ts
const input = assignRoleSchema.parse({ ...req.body, userId: req.params.id });
```

A failed parse throws `ZodError`, which the error handler turns into a `400`
with the messages joined.

---

## 8. The database connection

`src/db/index.ts` creates **one** pool for the whole process:

```ts
const sqlClient = postgres(connectionString(), {
  prepare: false, // a pooled endpoint in transaction mode cannot take prepared statements
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  onnotice: () => {},
});

export const db = drizzle(sqlClient, { schema });
```

Import `db` — never construct your own connection.

> **Why `prepare: false`?** Hosted Postgres (Neon, PgBouncer) in transaction
> mode cannot hold prepared statements across requests. Disabling them is what
> makes the pooled URL work.

---

## 9. Where to go next

| Topic                    | Document                                 |
| ------------------------ | ---------------------------------------- |
| Every endpoint           | [Routes](./02-routes.md)                 |
| What controllers do      | [Controllers](./03-controllers.md)       |
| Tables and relationships | [Database](./04-database.md)             |
| Login and roles          | [Authentication](./05-authentication.md) |

---

## Files this document was based on

- `apps/api/src/server.ts`, `src/app.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/middleware/error-handler.ts`, `async-handler.ts`
- `apps/api/src/lib/respond.ts`, `lib/http-error.ts`
- `apps/api/src/db/index.ts`
- `apps/api/src/routes/admin.ts`, `controllers/admin-users.ts`, `db/queries/users.ts`
- `packages/shared/src/validators/`
