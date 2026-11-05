# Authentication

## 1. What is it?

How someone signs in, and how the application decides what they are allowed to
do. It covers sign-up, sign-in, the approval workflow, roles, and password
recovery.

## 2. Who uses it?

Everyone. It is the first thing every user meets.

## 3. User Flow

### A new student

```text
1. Open the site → "Create account"
2. Enter name, email, password (12+ characters)
3. Land on /request → fill in board, level, subjects
4. Land on /pending → "An admin has to approve you"
5. (An admin approves)
6. The page updates by itself → /onboarding/parent
7. Create a link code, share it with a parent
8. (The parent redeems it)
9. → /student
```

### A new parent

```text
1. Open /sign-up/parent
2. Create an account
3. Ask for the parent role
4. (An admin approves)
5. Enter the child's link code on /parent/link
6. → /parent, now linked to that child
```

### An admin

```text
1. Sign in
2. → /admin/requests
3. Approve or reject each request, choosing the role
```

### The super admin

```text
1. Created by the seed script (or promoted by another super admin)
2. Signs in → /admin/requests immediately, with no request to file
```

## 4. Frontend

| File                             | What it does                          |
| -------------------------------- | ------------------------------------- |
| `app/sign-in/page.tsx`           | The sign-in form                      |
| `app/sign-up/page.tsx`           | The sign-up form                      |
| `app/sign-up/parent/page.tsx`    | The parent start page                 |
| `app/request/page.tsx`           | The access request form               |
| `app/pending/page.tsx`           | Waiting for approval (polls every 5s) |
| `app/rejected/page.tsx`          | Rejected, with a re-apply date        |
| `app/onboarding/parent/page.tsx` | The student's guardian step           |
| `app/parent/link/page.tsx`       | The parent redeems a code             |
| `lib/auth-context.tsx`           | The session                           |
| `lib/guards.tsx`                 | Panel guards                          |
| `lib/session.ts`                 | Token storage                         |

## 5. API

| Method | Path                           | Who                   |
| ------ | ------------------------------ | --------------------- |
| `POST` | `/auth/sign-up`                | anyone                |
| `POST` | `/auth/sign-in`                | anyone                |
| `POST` | `/auth/forgot-password`        | anyone                |
| `POST` | `/auth/reset-password`         | anyone                |
| `GET`  | `/me`                          | any signed-in account |
| `POST` | `/me/request`                  | any signed-in account |
| `POST` | `/me/request/parent`           | any signed-in account |
| `GET`  | `/me/request`                  | any signed-in account |
| `POST` | `/admin/requests/:id/decision` | admin                 |
| `POST` | `/admin/users/:id/role`        | admin                 |
| `POST` | `/student/parent-links`        | student (onboarding)  |
| `POST` | `/parent/parent-links/redeem`  | parent                |

## 6. Backend

| File                           | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `routes/me.ts`                 | Sign-in, sign-up, password reset, `/me`             |
| `middleware/auth.ts`           | Verifies the token, applies the gate, `requireRole` |
| `controllers/admin-users.ts`   | `assignRole`, `decideAccessRequest`                 |
| `controllers/parent.ts`        | Link codes                                          |
| `lib/password.ts`              | scrypt hashing                                      |
| `packages/shared/src/roles.ts` | Roles, statuses, `homeFor()`                        |

## 7. Database

| Table             | What it holds                                                      |
| ----------------- | ------------------------------------------------------------------ |
| `users`           | The account: email, password hash, role, status, `session_version` |
| `access_requests` | The approval queue                                                 |
| `parent_invites`  | Link codes                                                         |
| `guardianships`   | Parent ↔ student links                                             |
| `audit_logs`      | Every admin decision                                               |

## 8. Permissions

| Action               | Who                                         |
| -------------------- | ------------------------------------------- |
| Sign up              | anyone                                      |
| File a request       | any signed-in account                       |
| Approve a request    | admin, super admin                          |
| Assign a role        | admin (not to admins), super admin (anyone) |
| Promote to admin     | **super admin only**                        |
| Change a super admin | **nobody**                                  |
| Create a link code   | student                                     |
| Redeem a link code   | parent                                      |

## 9. Common Changes

### Add a new role

1. Add it to `USER_ROLES` in `packages/shared/src/roles.ts`.
2. Add its home to `ROLE_HOME`.
3. Add it to the `user_role` enum in `apps/api/src/db/schema.ts` and generate a
   migration.
4. Add a panel layout and its guard.
5. Add it to the admin role picker (`ROLES` in `request-actions.tsx`).

### Change the password rules

`apps/api/src/routes/me.ts` (sign-up) and `scripts/seed-super-admin.ts` both
enforce 12–128 characters. Change both, and the form's `minLength` in
`lib/auth.tsx`.

### Change where a role lands

`homeFor()` in `packages/shared/src/roles.ts`. Both the API and the web app call
it, so one change updates both.

### Make an endpoint reachable by a pending account

Use `auth({ allowRestricted: true })` on the route. See
[Authentication](../backend/05-authentication.md#allowrestricted).

## 10. Troubleshooting

| Symptom                                      | Cause                                    | Fix                                                  |
| -------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| 401 with a correct password                  | The account is not in this database      | Check `db:studio`; run the seed                      |
| 429 on sign-in                               | 10 attempts per 15 min                   | Wait, or raise `AUTH_ATTEMPT_LIMIT`                  |
| Signed out on every refresh                  | `ready` is true before the token is read | Check `auth-context.tsx` uses `useSyncExternalStore` |
| Stuck on `/pending` forever                  | No admin has approved                    | Approve from `/admin/requests`                       |
| Student cannot reach `/student`              | No guardian linked                       | Complete `/onboarding/parent`                        |
| 403 "Account is pending" on the request form | The endpoint uses plain `auth()`         | Use `allowRestricted`                                |
| Role changed but the old role still works    | The token was not refreshed              | Sign out and in — `session_version` was bumped       |

## 11. Related Code

- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/me.ts`
- `apps/web/lib/auth-context.tsx`
- `apps/web/lib/guards.tsx`
- `packages/shared/src/roles.ts`
- [Backend: Authentication](../backend/05-authentication.md)
