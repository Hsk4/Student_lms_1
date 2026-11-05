# Pages

**Purpose:** a complete map of every route in the web app — what it shows, who
can reach it, and which file defines it.

The folder path **is** the URL. `app/admin/users/page.tsx` serves `/admin/users`.

---

## 1. Public pages

| URL                | File                           | Rendering  | What it shows                           |
| ------------------ | ------------------------------ | ---------- | --------------------------------------- |
| `/`                | `app/page.tsx`                 | **Server** | The marketing landing page              |
| `/mobile`          | `app/mobile/page.tsx`          | Client     | A design reference of the phone screens |
| `/sign-in`         | `app/sign-in/page.tsx`         | Client     | Email + password form                   |
| `/sign-up`         | `app/sign-up/page.tsx`         | Client     | Create an account                       |
| `/sign-up/parent`  | `app/sign-up/parent/page.tsx`  | Client     | The parent start page                   |
| `/forgot-password` | `app/forgot-password/page.tsx` | Client     | Request a reset link                    |
| `/reset-password`  | `app/reset-password/page.tsx`  | Client     | Set a new password                      |
| `/invite`          | `app/invite/page.tsx`          | Client     | The page a parent opens from a link code |

> **Only `/` is server-rendered.** It is the only public page with content worth
> indexing. See [Rendering and Builds](./05-rendering-and-builds.md).

---

## 2. Gate pages

These are for a signed-in account that is **not yet usable**. They share
`GateShell` (the navy band + white sheet).

| URL                  | File                             | Who lands here                                   |
| -------------------- | -------------------------------- | ------------------------------------------------ |
| `/request`           | `app/request/page.tsx`           | A role-less account that has not filed a request |
| `/pending`           | `app/pending/page.tsx`           | An account waiting for approval                  |
| `/rejected`          | `app/rejected/page.tsx`          | A rejected account (can re-apply after 30 days)  |
| `/onboarding/parent` | `app/onboarding/parent/page.tsx` | A student with no linked guardian                |

The API decides which one you get, through `homeFor()`.

---

## 3. Admin panel — `/admin/**`

Guarded by `app/admin/layout.tsx` → `usePanelGuard(["super_admin", "admin"])`.

| URL                        | What it shows                                         |
| -------------------------- | ----------------------------------------------------- |
| `/admin`                   | Redirects to the requests queue                       |
| `/admin/requests`          | The approval queue — approve or reject                |
| `/admin/users`             | All accounts, filterable, with role/status actions    |
| `/admin/users/detail?id=…` | One account, with role assignment and teacher courses |
| `/admin/admins`            | Admin accounts (super admin only)                     |
| `/admin/analytics`         | Dashboard numbers                                     |
| `/admin/audit-log`         | The last 200 admin actions                            |
| `/admin/support`           | Support tickets                                       |
| `/admin/boards`            | Exam boards                                           |
| `/admin/courses`           | Courses (board + level + subject)                     |
| `/admin/courses/detail?id=…` | One course                                          |
| `/admin/books`             | Books                                                 |
| `/admin/books/detail?id=…` | One book                                              |
| `/admin/materials`         | Course materials                                      |
| `/admin/enrollments`       | Student–teacher enrollments                           |
| `/admin/invoices`          | Fees                                                  |
| `/admin/parent-invites`    | Link codes and guardian links                         |
| `/admin/settings`          | A read-only settings summary                          |

> **Why `?id=` and not `/admin/users/[id]`?** A static export cannot pre-render
> an unknown id, so detail pages take the id as a query parameter and read it
> inside a `Suspense` boundary.

---

## 4. Teacher panel — `/teacher/**`

Guarded by `app/teacher/layout.tsx` → `usePanelGuard(["teacher"])`.

| URL                             | What it shows                                  |
| ------------------------------- | ---------------------------------------------- |
| `/teacher`                      | Dashboard: students, classes, pending requests |
| `/teacher/students`             | The teacher's students                         |
| `/teacher/students/detail?id=…` | One student                                    |
| `/teacher/classes`              | Classes                                        |
| `/teacher/classes/detail?id=…`  | One class                                      |
| `/teacher/attendance`           | Take attendance                                |
| `/teacher/assignments`          | Assignments and grading                        |
| `/teacher/meetings`             | Parent meetings                                |
| `/teacher/requests`             | Enrollment requests to accept or decline       |
| `/teacher/support`              | Support tickets                                |

---

## 5. Student panel — `/student/**`

Guarded by `app/student/layout.tsx` → `usePanelGuard(["student"])`. Uses bottom
tabs on a phone.

| URL                    | What it shows                   |
| ---------------------- | ------------------------------- |
| `/student`             | Dashboard                       |
| `/student/assignments` | Work to do and submitted work   |
| `/student/attendance`  | Attendance record               |
| `/student/courses`     | Enrolled courses                |
| `/student/books`       | Books                           |
| `/student/materials`   | Course materials                |
| `/student/quizzes`     | Quizzes                         |
| `/student/teachers`    | Teachers to request             |
| `/student/invoices`    | Fees                            |
| `/student/guardians`   | Linked guardians and link codes |
| `/student/support`     | Support tickets                 |

> A student who has not linked a guardian never reaches these pages — the guard
> sends them to `/onboarding/parent`.

---

## 6. Parent panel — `/parent/**`

Guarded by `app/parent/layout.tsx` → `usePanelGuard(["parent"])`. Uses bottom
tabs on a phone.

| URL                            | What it shows                             |
| ------------------------------ | ----------------------------------------- |
| `/parent`                      | Children overview                         |
| `/parent/children`             | The same list, lighter                    |
| `/parent/children/detail?id=…` | One child's progress, attendance and fees |
| `/parent/invoices`             | Fees per child                            |
| `/parent/meetings`             | Meetings with teachers                    |
| `/parent/link`                 | Redeem a child's link code                |

---

## 7. How a page is structured

Every private page follows the same shape:

```tsx
"use client";

export default function SomePage() {
  const query = useAsync(() => api.get<Data>("/some/endpoint"), []);

  if (query.loading) return <InlineLoading />;
  if (query.error) return <p>{query.error.message}</p>;

  return (
    <>
      <PageHeader title="…" description="…" />
      {/* the content */}
    </>
  );
}
```

The panel's `layout.tsx` supplies the sidebar, the topbar and the guard, so a
page only renders its own content.

---

## 8. Adding a page

### A private panel page

1. Create `app/<panel>/<name>/page.tsx`.
2. Add `"use client"`.
3. Fetch with `useAsync` / `useApi`.
4. Add the nav entry in `components/shell/nav-config.ts`.

The layout's guard already protects it.

### A public page

1. Create `app/<name>/page.tsx`.
2. **Do not** add `"use client"`.
3. Export `metadata`.

See [Rendering and Builds](./05-rendering-and-builds.md#5-adding-a-page).

---

## 9. Related

- [Web Overview](./01-web-overview.md)
- [Components](./03-components.md)
- [Rendering and Builds](./05-rendering-and-builds.md)

---

## Files this document was based on

- `apps/web/app/**/page.tsx` — every route
- `apps/web/app/{admin,teacher,student,parent}/layout.tsx` — the guards
- `apps/web/components/shell/nav-config.ts` — the nav entries
- `packages/shared/src/roles.ts` — `homeFor()`
