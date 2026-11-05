# Authentication and Authorization

**Purpose:** explain how someone proves who they are (authentication), how the
API decides what they may do (authorization), and where each rule lives.

These are two different questions, and this codebase answers them in two
different places.

| Question           | Name           | Answered by                                                   |
| ------------------ | -------------- | ------------------------------------------------------------- |
| "Who are you?"     | Authentication | `middleware/auth.ts` — verifies the token                     |
| "May you do this?" | Authorization  | `requireRole(...)` in routes, ownership checks in controllers |

---

## 1. The whole flow

```text
1. User types email + password
        │
        ▼
2. POST /api/v1/auth/sign-in
        │
        ▼
3. API looks up the user by email
   verifies the password against the scrypt hash
        │
        ▼
4. API signs a JWT with AUTH_JWT_SECRET
   { sub, email, name, role, status, onboarded, sessionVersion, exp }
        │
        ▼
5. Browser stores the token in localStorage
        │
        ▼
6. Every later request sends  Authorization: Bearer <token>
        │
        ▼
7. auth() verifies the signature, loads the user row,
   checks sessionVersion, and attaches req.user
        │
        ▼
8. requireRole(...) checks the role
        │
        ▼
9. Controller runs
```

---

## 2. Sign-in

`POST /api/v1/auth/sign-in` (`routes/me.ts`):

```ts
const credentials = await findUserCredentialsByEmail(email);
const user = credentials?.user ?? null;
const passwordMatches = await verifyPassword(
  password,
  credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
);

if (!user || !passwordMatches) {
  res.status(401).json({ ok: false, error: "Invalid email or password" });
  return;
}
```

Two details worth knowing:

- **The same error for both cases.** "No such account" and "wrong password"
  return the identical message, so an attacker cannot discover which emails
  exist.
- **`DUMMY_PASSWORD_HASH`.** When the email is unknown, the code still runs a
  scrypt verification against a dummy hash. Without it, an unknown email would
  answer faster than a known one, and the timing difference would leak the same
  information.

### Rate limiting

Sign-in allows **10 attempts per 15 minutes per IP**. Override it with
`AUTH_ATTEMPT_LIMIT` while developing.

---

## 3. The token

A JWT signed with **HS256** using `AUTH_JWT_SECRET`:

```ts
const claims = {
  sub: user.clerkId, // the account's identity string
  email,
  name,
  role,
  status,
  onboarded,
  sessionVersion,
  iat: now,
  exp: now + 60 * 60 * 24 * 7, // 7 days
};
```

> **Why is the role in the token if the database is authoritative?** It is a
> convenience for the client, not a permission. `auth()` re-reads the row on
> every request and uses **that** role. A token claiming `super_admin` for an
> account that is now a student grants nothing.

### `sessionVersion`

Every account has a `session_version` integer. The token carries the value it
was minted with. `auth()` compares them:

```ts
if ((session.version ?? 0) !== record.sessionVersion) throw unauthorized();
```

Bumping the column invalidates **every** existing token for that account. That
is how a role change, a suspension or a password reset takes effect immediately
instead of waiting for the token to expire.

---

## 4. Verifying a request

`auth()` in `middleware/auth.ts`:

```ts
const [scheme, token] = (req.headers.authorization ?? "").split(" ");
if (scheme !== "Bearer" || !token) throw unauthorized();

const session = await verify(token); // signature + expiry
const record = await adoptOrPending(session.clerkId);
if (session.sessionVersion !== record.sessionVersion) throw unauthorized();

req.user = record.user;
```

Then the gate:

```ts
if (user.status === "suspended")
  throw notReady("Unauthorized: account is suspended");
if (restricted) return next(); // allowRestricted

if (user.status !== "active" && !(user.status === "pending" && user.role)) {
  throw notReady(`Account is ${user.status}: ${homeFor(user)}`);
}
if (user.role === "student" && !user.onboarded) {
  throw notReady(`Account needs onboarding: ${homeFor(user)}`);
}
```

### The two special cases

**A role is the approval.** A `pending` account that already holds a role is
admitted. This is what lets the seeded super admin in without an access request.

**A student is not finished until a parent is linked.** Until `onboarded` is
true, every student endpoint returns `403` and the app sends them to
`/onboarding/parent`.

### `allowRestricted`

Some endpoints are the onboarding step itself. They opt out of the gate:

```ts
const onboardingStep = auth({ allowRestricted: true });
```

Used by these routes:

| Route                                   | Why                                                          |
| --------------------------------------- | ------------------------------------------------------------ |
| `GET /me`                               | A pending account must read its own profile — guards need it |
| `GET /me/request`                       | It must see its own request status                           |
| `POST /me/request`                      | Filing the request **is** the onboarding step                |
| `POST /me/request/parent`               | Same, for the parent role                                    |
| `GET /me/status`                        | A light status check                                         |
| `POST /student/parent-links`            | Creating the link code **is** onboarding                     |
| `POST /student/parent-links/:id/revoke` | Same flow                                                    |
| `GET /catalog/form-options`             | The request form is filled in by pending accounts            |

> **`/me` is the important one.** Without it a pending account could not load
> its own profile, and the whole gate flow would have nothing to render.

> **This is a real bug class.** Both of the last two were originally plain
> `auth()`, which answered `403` to the only people who needed them. If you add
> an endpoint that a pending account must reach, it needs `allowRestricted`.

---

## 5. Authorization

### Role checks — in the route

```ts
const admin = [auth(), requireRole("admin", "super_admin")];

adminRoutes.get("/admin/users", ...admin, handler);
```

`requireRole` reads `req.user.role` and compares it to the list. A role is
required; a null role is always refused.

### Record-level checks — in the controller

A role check says "an admin may manage users". It does not say _which_ users:

```ts
function canManage(actorRole, targetRole) {
  if (targetRole === "super_admin") return false; // nobody
  if (targetRole === "admin") return actorRole === "super_admin"; // only a super admin
  return true;
}
```

> **The rule:** role gates in routes, ownership checks in controllers. If you
> add an endpoint that touches one record, the "is this theirs?" check belongs
> in the controller.

---

## 6. The roles

| Role          | Home       | How it is obtained                                 |
| ------------- | ---------- | -------------------------------------------------- |
| `super_admin` | `/admin`   | The seed script, or another super admin            |
| `admin`       | `/admin`   | A super admin assigns it                           |
| `teacher`     | `/teacher` | Sign up → request → admin approves                 |
| `student`     | `/student` | Sign up → request → admin approves → link a parent |
| `parent`      | `/parent`  | Sign up → request → admin approves → redeem a code |

### The statuses

| Status      | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `pending`   | Waiting for a decision (or, with a role, already approved) |
| `active`    | Usable                                                     |
| `rejected`  | Declined; can re-apply after 30 days                       |
| `suspended` | Refused everywhere, including `/me`                        |

### `homeFor()` — the one place that decides

`packages/shared/src/roles.ts`:

```ts
export function homeFor(user) {
  if (user.status === "suspended") return "/?error=account_suspended";
  if (user.status === "pending" && !user.role) return "/pending";
  if (user.status === "rejected" && !user.role) return "/rejected";
  if (user.role === "student" && !user.onboarded) return "/onboarding/parent";
  if (!user.role) return "/request";
  return ROLE_HOME[user.role];
}
```

Both the API (for the 403 message) and the web app (for the redirect) call this.
Two copies would drift.

---

## 7. The client side

### Storing the token

`apps/web/lib/session.ts` — `localStorage`, key `lms-auth-token`.

> **Why `localStorage` and not a cookie?** The app is a static export and a
> Capacitor webview; there is no server to set an HttpOnly cookie. The trade-off
> is that JavaScript can read the token, so an XSS bug would expose it. The
> mitigation is that the app renders no user-supplied HTML.

### Sending it

`apps/web/lib/api-client.ts` reads the token at call time and adds the header:

```ts
const token = readToken();
if (token) headers.Authorization = `Bearer ${token}`;
```

### Reacting to a 401

A 401 from anywhere means the token is dead. The client reports it once:

```ts
if (response.status === 401) notifyUnauthorized();
```

`AuthProvider` clears the session, and the guards redirect on the next render.

### The provider

`apps/web/lib/auth-context.tsx` holds the session in plain React state:

- one `/me` request per page load, **only when a token exists**;
- `ready` is false until the client has actually read `localStorage`, so a hard
  load never looks signed out for a tick;
- `signOut()` clears storage and navigates.

> **Why not a query cache?** It was one, and it caused a 401 storm: every page
> mounted a guard, each fired `/me` with no token, and each 401 triggered a
> redirect that remounted the tree. The provider is the state now.

---

## 8. Password recovery

`POST /auth/forgot-password` → emails a link (needs `RESEND_API_KEY` and
`AUTH_EMAIL_FROM`).
`POST /auth/reset-password` → sets a new password from the token.

The reset token is stored **hashed** (`sha256`), expires, and is single-use.
Resetting bumps `session_version`, so every existing session ends.

If email is not configured, the route answers with a clear "not configured"
error rather than pretending to send.

---

## 9. Common problems

| Symptom                          | Cause                                                     | Fix                                                                                 |
| -------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `401` on every request           | Token missing, expired, or signed with a different secret | Sign in again; check `AUTH_JWT_SECRET` did not change                               |
| `401` right after a role change  | `session_version` was bumped                              | Sign in again — this is intended                                                    |
| `403 "Account is pending"`       | The account has no role yet                               | Approve the request, or use `allowRestricted` if the endpoint is part of onboarding |
| `403 "Account needs onboarding"` | A student with no linked parent                           | Complete `/onboarding/parent`                                                       |
| `429` on sign-in                 | 10 attempts in 15 minutes                                 | Wait, or raise `AUTH_ATTEMPT_LIMIT` locally                                         |
| Signed out on every refresh      | `ready` is true before the token is read                  | Check `auth-context.tsx` still uses `useSyncExternalStore`                          |

---

## 10. Related

- [Routes](./02-routes.md)
- [Controllers](./03-controllers.md)
- [Authentication feature](../features/authentication.md) — the user-facing flow

---

## Files this document was based on

- `apps/api/src/middleware/auth.ts` — token verification, the gate, `requireRole`
- `apps/api/src/routes/me.ts` — sign-in, sign-up, password reset
- `apps/api/src/routes/parent.ts`, `catalog.ts` — `allowRestricted` uses
- `apps/api/src/controllers/admin-users.ts` — `canManage`
- `packages/shared/src/roles.ts` — roles, statuses, `homeFor()`
- `apps/web/lib/session.ts`, `api-client.ts`, `auth-context.tsx`, `guards.tsx`
