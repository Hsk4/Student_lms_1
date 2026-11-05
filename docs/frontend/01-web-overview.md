# Web Overview

**Purpose:** understand how the frontend is built — how a page gets its data,
how the session works, and where to look when something on screen is wrong.

---

## 1. What the frontend is

A **Next.js 16** app in `apps/web`. It has two build targets (see
[Rendering and Builds](./05-rendering-and-builds.md)):

| Target | What it produces          | Where it runs           |
| ------ | ------------------------- | ----------------------- |
| Web    | A normal Next build       | Vercel                  |
| Mobile | A static export in `out/` | Capacitor (Android/iOS) |

**The application code is the same in both.** Only the landing page is
server-rendered; everything else is a client component.

---

## 2. The layers

```text
app/            one folder per URL — the pages
components/     the pieces pages are built from
lib/            the plumbing: API, session, data hooks, guards
views/          larger composed screens (the root shell)
```

### `app/` — pages

The folder path **is** the URL:

| URL                        | File                              |
| -------------------------- | --------------------------------- |
| `/`                        | `app/page.tsx`                    |
| `/sign-in`                 | `app/sign-in/page.tsx`            |
| `/admin/users`             | `app/admin/users/page.tsx`        |
| `/admin/users/detail?id=…` | `app/admin/users/detail/page.tsx` |

A `layout.tsx` wraps every page beneath it. There are five:

| Layout                   | Wraps         | What it adds                     |
| ------------------------ | ------------- | -------------------------------- |
| `app/layout.tsx`         | everything    | Fonts, theme script, `Providers` |
| `app/admin/layout.tsx`   | `/admin/**`   | Sidebar + the admin guard        |
| `app/teacher/layout.tsx` | `/teacher/**` | Sidebar + the teacher guard      |
| `app/student/layout.tsx` | `/student/**` | Bottom tabs on phones + the student guard |
| `app/parent/layout.tsx`  | `/parent/**`  | Bottom tabs on phones + the parent guard  |

> Admin and teacher use a sidebar at every width. Student and parent switch to
> a bottom tab bar on a phone (`mobile="bottom-tabs"`), because their panels
> have few enough sections to fit a thumb-width bar.

> **Why the guard lives in the layout:** every page under `/admin` needs the
> same check. Putting it in the layout means a new admin page is protected
> automatically.

### `components/` — the pieces

| Folder     | Contains                                                          |
| ---------- | ----------------------------------------------------------------- |
| `ui/`      | The design system: `Button`, `Card`, `Table`, `Chip`, `Notice`…   |
| `shell/`   | The app frame: sidebar, topbar, page actions, nav config          |
| `shared/`  | Reusable pieces: empty states, skeletons, data tables, pagination |
| `brand/`   | Logo, illustrations, the landing page sections                    |
| `support/` | Support-ticket forms                                              |

### `lib/` — the plumbing

This is the folder to learn first.

| File               | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `api-client.ts`    | The only way the app talks to the API                     |
| `session.ts`       | Reads/writes the token in `localStorage`                  |
| `auth-context.tsx` | `AuthProvider` + `useAuth()` — who is signed in           |
| `use-async.ts`     | `useAsync`, `useApi`, `useAction` — the data layer        |
| `guards.tsx`       | `usePanelGuard` — redirects a user out of the wrong panel |
| `school.ts`        | The school's name                                         |
| `theme.ts`         | Light/dark handling                                       |

---

## 3. How a page gets its data

There is **no global cache**. A page fetches what it needs, and reloads itself
after a change.

```tsx
"use client";

export default function AdminUsersPage() {
  const usersQuery = useAsync(
    () => api.get<UsersResponse>("/admin/users", { status, role, q, page }),
    [status, role, q, page], // re-runs when any of these change
  );

  if (usersQuery.loading) return <InlineLoading />;
  if (usersQuery.error) return <p>{usersQuery.error.message}</p>;

  return <Table rows={usersQuery.data?.users ?? []} />;
}
```

`useAsync` returns:

| Field      | Meaning                                          |
| ---------- | ------------------------------------------------ |
| `data`     | The result, or `undefined` before the first load |
| `error`    | The failure, or `null`                           |
| `loading`  | A request is in flight                           |
| `fetched`  | The first load finished (success or failure)     |
| `reload()` | Re-run the request                               |

### After a change

A mutation does not invalidate a cache — the page reloads itself:

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

> **Why no cache?** It was one (TanStack Query), and it caused a 401 storm: every
> page mounted a guard, each fired `/me` with no token, and each 401 triggered a
> redirect that remounted the tree. Now "which request runs when" is answerable
> by reading the page.

---

## 4. The session

`AuthProvider` (`lib/auth-context.tsx`) holds the signed-in account in plain
React state.

```tsx
const { ready, signedIn, user, loading, error, refresh, signOut } = useAuth();
```

| Field      | Meaning                                                           |
| ---------- | ----------------------------------------------------------------- |
| `ready`    | The client has read `localStorage` — **not** "the browser exists" |
| `signedIn` | A token is present                                                |
| `user`     | The profile from `/me`, or `null`                                 |
| `loading`  | `/me` is in flight                                                |
| `settled`  | The provider has finished deciding                                |

**One `/me` per page load, and only when a token exists.** A signed-out visitor
makes no request at all.

> **Why `ready` matters:** it used to be `typeof window !== "undefined"`, which
> is true before the token is read. Every hard load briefly looked signed out,
> so the guard redirected to `/sign-in` and then to the role home. A refresh
> lost your page.

---

## 5. Guards

`usePanelGuard(roles)` in `lib/guards.tsx`:

```tsx
const { user, allowed, denied, isLoading, error } = usePanelGuard([
  "admin",
  "super_admin",
]);
```

| Situation             | Result                           |
| --------------------- | -------------------------------- |
| Not signed in         | redirect to `/sign-in`           |
| Wrong role            | redirect to `user.home`          |
| Student not onboarded | redirect to `/onboarding/parent` |
| Allowed               | render the page                  |

> **These guards are UX only.** They decide which page to _show_. The API is the
> real gate — a user who bypasses the guard still gets `403` from every endpoint.

---

## 6. Loading and error states

| State               | What to show                           |
| ------------------- | -------------------------------------- |
| First load          | `<InlineLoading />` or a skeleton      |
| A list with no rows | `<EmptyState />` — **not** a spinner   |
| A failed request    | The error message, with a way to retry |

> **A real bug this fixed:** pages passed `empty={rows.length === 0}`, which is
> true _while loading_, so a list showed "No users match" for a second before
> the rows arrived. `DataTableView` now takes a `loading` prop.

---

## 7. Talking to the API

`lib/api-client.ts` is the only place that calls `fetch`:

```ts
const token = readToken();
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(`${BASE_URL}${path}`, { method, headers, body });
```

It unwraps `{ ok, data }` and throws `ApiError` on failure, so a page only ever
sees data or an error.

`BASE_URL` comes from `NEXT_PUBLIC_API_URL`, which is **baked in at build time**.

Full detail: [API Communication](./04-api-communication.md).

---

## 8. Where to look for…

| Question                        | File                                       |
| ------------------------------- | ------------------------------------------ |
| "Where is this screen?"         | `app/<path>/page.tsx`                      |
| "Where is this button?"         | `components/ui/`                           |
| "How does this page get data?"  | the `useAsync(...)` at the top of the page |
| "Why was I redirected?"         | `lib/guards.tsx`                           |
| "Why was I signed out?"         | `lib/auth-context.tsx`                     |
| "Why is the API call failing?"  | `lib/api-client.ts`                        |
| "Where is the sidebar defined?" | `components/shell/nav-config.ts`           |

---

## 9. Related

- [Pages](./02-pages.md) — every route
- [Components](./03-components.md) — the design system
- [API Communication](./04-api-communication.md)
- [Rendering and Builds](./05-rendering-and-builds.md)

---

## Files this document was based on

- `apps/web/app/` — the page and layout tree
- `apps/web/lib/api-client.ts`, `session.ts`, `auth-context.tsx`, `use-async.ts`, `guards.tsx`
- `apps/web/components/shared/data-table-view.tsx`
- `apps/web/next.config.ts`
