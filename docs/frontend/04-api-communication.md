# API Communication

**Purpose:** how the browser talks to the API — the one client, the envelope,
the token, and what every failure means.

---

## 1. The rule

> **Every request goes through `lib/api-client.ts`.**

No page calls `fetch` directly. That one file adds the token, unwraps the
response, and turns failures into a typed error.

```ts
import { api } from "@/lib/api-client";

const users = await api.get<UsersResponse>("/admin/users", { page: 1 });
await api.post("/admin/boards", { name: "Sindh Board" });
await api.patch(`/admin/boards/${id}`, { active: false });
await api.delete("/admin/materials", { id });
```

---

## 2. The base URL

```ts
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
```

| Environment | Value                                            |
| ----------- | ------------------------------------------------ |
| Development | `http://localhost:4000/api/v1`                   |
| Production  | `https://student-lms-1-g0xa.onrender.com/api/v1` |

> **`NEXT_PUBLIC_*` is baked in at build time.** Changing `.env.local` does
> nothing until the dev server restarts; a production build must be rebuilt.
> This is the most common "the API is broken" report.

A production build that falls back to localhost logs a loud console error,
because that is a build mistake, not a runtime condition.

---

## 3. The request

```ts
const token = readToken(); // from localStorage
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(`${BASE_URL}${path}`, { method, headers, body });
```

The token is read **at call time**, not captured in a closure, so a request made
immediately after sign-in never uses a stale value.

Query parameters are built by `withQuery()`, which skips `undefined`, `null` and
`""` — so `{ status: "", role: "" }` sends nothing rather than `?status=&role=`.

---

## 4. The response envelope

Every API response is one of two shapes:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": "An account with that email already exists." }
```

`apiFetch` unwraps it:

```ts
if (!response.ok || !payload || payload.ok === false) {
  throw new ApiError(response.status, message);
}
return payload.data;
```

So a page only ever sees **data** or a thrown **`ApiError`**.

---

## 5. Errors

`ApiError` carries the HTTP status and a message written for a human:

```ts
export class ApiError extends Error {
  readonly status: number;
}
```

| Status | Meaning                                    | What the app does                        |
| ------ | ------------------------------------------ | ---------------------------------------- |
| `0`    | Network or CORS failure                    | Shows "Cannot reach the school server"   |
| `400`  | Validation                                 | Shows the message next to the form       |
| `401`  | Token dead                                 | Clears the session, redirects to sign-in |
| `403`  | Not allowed (role, pending, not onboarded) | Shows the message; **does not** sign out |
| `404`  | Not found                                  | Shows the message                        |
| `409`  | Conflict                                   | Shows the message                        |
| `500`  | Server error                               | Shows the message                        |

> **Why 403 does not sign you out:** a 403 is a _policy answer_ — "you are
> signed in, but not allowed". Signing out would be wrong. Only a 401 means the
> token itself is unusable.

### Status 0 — the three network cases

A `fetch` that throws is not an HTTP status. The client tells three cases apart:

```ts
const offline = navigator.onLine === false;
throw new ApiError(
  0,
  offline
    ? "You are offline. Check your connection and try again."
    : `Cannot reach the school server at ${BASE_URL}. It may be waking up — try again in a moment.`,
);
```

> **Why bother?** "Failed to fetch" helps nobody on a phone. A free Render
> instance sleeps, so "it may be waking up" is usually the true answer.

---

## 6. Reading data

`useAsync` and `useApi` wrap the client:

```tsx
// explicit fetcher
const query = useAsync(() => api.get<Data>("/admin/users", { page }), [page]);

// shorthand
const query = useApi<Data>("/admin/users", { page }, { deps: [page] });
```

| Field      | Meaning                    |
| ---------- | -------------------------- |
| `data`     | The result, or `undefined` |
| `error`    | The `ApiError`, or `null`  |
| `loading`  | A request is in flight     |
| `fetched`  | The first load finished    |
| `reload()` | Re-run it                  |

The second argument is the **dependency list**: when any value changes, the
request re-runs. This replaces query keys — the values are read directly.

```tsx
const usersQuery = useAsync(
  () => api.get<UsersResponse>("/admin/users", { status, role, q, page }),
  [status, role, q, page],
);
```

### Skipping a request

```tsx
useAsync(() => api.get(`/admin/users/${id}`), [id], { enabled: Boolean(id) });
```

### Polling

```tsx
useAsync(() => api.get("/me/request"), [], { interval: 5000 });
```

Only the pending page polls.

---

## 7. Sending data

`useAction` wraps a mutation:

```tsx
const decide = useAction(usersQuery.reload);

<ActionButton
  action={() =>
    decide.run(() => api.post(`/admin/requests/${id}/decision`, body))
  }
>
  Approve
</ActionButton>;
```

| Field     | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `pending` | A submit is in flight                                 |
| `error`   | The failure message, or `null`                        |
| `run(fn)` | Run it; returns the value, or `undefined` if it threw |

The argument to `useAction` is what runs **after success** — usually the page's
`reload`.

> **Why no cache invalidation?** There is no cache. A page reloads the data it
> shows, explicitly. The cost is one line; the benefit is that "which request
> runs when" is answerable by reading the page.

---

## 8. The full round trip

```text
User clicks "Approve"
        │
        ▼
request-actions.tsx
  decide.run(() => api.post(`/admin/requests/${id}/decision`, { decision: "approve", role }))
        │
        ▼
api-client.ts
  readToken() → Authorization: Bearer …
  fetch("https://…/api/v1/admin/requests/<id>/decision", { method: "POST", body })
        │
        ▼
API: CORS → rate limit → auth() → requireRole() → controller → Drizzle → Postgres
        │
        ▼
{ ok: true, data: null }
        │
        ▼
api-client.ts unwraps → returns null
        │
        ▼
useAction calls onDone() → usersQuery.reload()
        │
        ▼
The list re-fetches and re-renders
```

---

## 9. CORS

The browser blocks a response when the API does not allow the page's origin.
The API's allow-list is `WEB_ORIGIN` plus the Capacitor origins.

| Where the app runs | Origin                                | Allowed by       |
| ------------------ | ------------------------------------- | ---------------- |
| Local dev          | `http://localhost:3000`               | Development only |
| Vercel             | `https://studentlms-sooty.vercel.app` | `WEB_ORIGIN`     |
| Android            | `https://localhost`                   | Always           |
| iOS                | `capacitor://localhost`               | Always           |

> **If the console says "blocked by CORS policy", the fix is in the API's
> `WEB_ORIGIN`, not in the frontend.** The server answered; the browser threw it
> away.

---

## 10. Common problems

| Symptom                          | Cause                                        | Fix                                |
| -------------------------------- | -------------------------------------------- | ---------------------------------- |
| "Cannot reach the school server" | API down, or wrong `NEXT_PUBLIC_API_URL`     | Start the API; rebuild the web app |
| "blocked by CORS policy"         | Origin not in `WEB_ORIGIN`                   | Add it in Render, restart          |
| Every request 401                | Token missing or expired                     | Sign in again                      |
| 403 on a page that should work   | Wrong role, or the account is pending        | Check the route's `requireRole`    |
| Data never appears               | `enabled` is false, or the deps never change | Check the `useAsync` call          |
| Stale data after a change        | `onDone` / `reload` not wired                | Pass the page's `reload`           |

---

## 11. Related

- [Web Overview](./01-web-overview.md)
- [Authentication](../backend/05-authentication.md)
- [API Overview](../backend/01-api-overview.md)

---

## Files this document was based on

- `apps/web/lib/api-client.ts` — the whole client
- `apps/web/lib/use-async.ts` — `useAsync`, `useApi`, `useAction`
- `apps/web/lib/session.ts` — the token
- `apps/api/src/app.ts` — CORS
- `apps/web/app/admin/requests/request-actions.tsx` — the worked example
