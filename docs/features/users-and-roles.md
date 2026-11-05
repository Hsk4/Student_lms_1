# Users and Roles

## 1. What is it?

The admin's control over accounts: who exists, what role they have, whether they
are active, and the audit trail of every change.

## 2. Who uses it?

Admins and super admins.

## 3. User Flow

```text
/admin/requests  → approve or reject a request, choosing the role
/admin/users     → search, filter, open an account
/admin/users/detail?id=… → change role, suspend, reinstate, set teacher courses
/admin/admins    → the admin accounts (super admin only)
/admin/audit-log → what changed, by whom, from what to what
```

## 4. Frontend

| File                                          | What it shows            |
| --------------------------------------------- | ------------------------ |
| `app/admin/requests/page.tsx`                 | The approval queue       |
| `app/admin/requests/request-actions.tsx`      | Approve / reject         |
| `app/admin/users/page.tsx`                    | The user list            |
| `app/admin/users/detail/page.tsx`             | One account              |
| `app/admin/users/detail/user-actions.tsx`     | Role, suspend, reinstate |
| `app/admin/users/detail/user-detail-view.tsx` | The detail layout        |
| `app/admin/users/teacher-courses.tsx`         | A teacher's courses      |
| `app/admin/users/auto-refresh.tsx`            | Reloads on tab focus     |
| `app/admin/admins/page.tsx`                   | Admin accounts           |
| `app/admin/audit-log/page.tsx`                | The audit trail          |

## 5. API

| Method  | Path                           | What it does                          |
| ------- | ------------------------------ | ------------------------------------- |
| `GET`   | `/admin/users`                 | Paged, filterable list with counts    |
| `GET`   | `/admin/users/:id`             | One account                           |
| `POST`  | `/admin/users/:id/role`        | Assign a role (activates the account) |
| `POST`  | `/admin/users/:id/reject`      | Reject with a reason                  |
| `POST`  | `/admin/users/:id/suspend`     | Suspend                               |
| `POST`  | `/admin/users/:id/reinstate`   | Reinstate                             |
| `PATCH` | `/admin/users/:id/courses`     | Set a teacher's courses               |
| `GET`   | `/admin/requests`              | The queue                             |
| `POST`  | `/admin/requests/:id/decision` | Approve or reject                     |
| `GET`   | `/admin/audit-log`             | The last 200 entries                  |

## 6. Backend

| File                         | What it does      |
| ---------------------------- | ----------------- |
| `routes/admin.ts`            | The admin routes  |
| `controllers/admin-users.ts` | Every user action |
| `db/queries/users.ts`        | The SQL           |
| `lib/audit.ts`               | `writeAudit`      |

### The rule that governs everything

```ts
function canManage(actorRole, targetRole) {
  if (targetRole === "super_admin") return false; // nobody
  if (targetRole === "admin") return actorRole === "super_admin"; // only a super admin
  return true;
}
```

An admin can manage teachers, students and parents. Only a super admin can
manage admins. **Nobody** can change a super admin.

## 7. Database

| Table             | What it holds       |
| ----------------- | ------------------- |
| `users`           | The account         |
| `access_requests` | The queue           |
| `audit_logs`      | Every change        |
| `teacher_courses` | A teacher's courses |

Every admin action is one transaction: the user row, the request and the audit
entry commit together or not at all.

## 8. Permissions

| Action                        | admin          | super_admin          |
| ----------------------------- | -------------- | -------------------- |
| View users                    | ✓              | ✓                    |
| Assign teacher/student/parent | ✓              | ✓                    |
| Assign admin                  | —              | ✓                    |
| Change a super admin          | —              | —                    |
| Suspend / reinstate           | ✓ (not admins) | ✓ (not super admins) |
| View the audit log            | ✓              | ✓                    |

## 9. Common Changes

### Add a role to the picker

`app/admin/requests/request-actions.tsx` → the `ROLES` array. Also add it to
`USER_ROLES` in `packages/shared/src/roles.ts` and the database enum.

### Change what a role can do

The route's `requireRole(...)` list. Then check the panel's `layout.tsx` so the
UI agrees.

### Add an audit entry to a new action

```ts
await writeAudit(
  {
    actorId: actor.id,
    action: "something",
    targetType: "User",
    targetId,
    before,
    after,
  },
  tx,
);
```

## 10. Troubleshooting

| Symptom                                 | Cause                                               | Fix                                                    |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| "You cannot change this user"           | `canManage` refused it                              | Only a super admin can manage an admin                 |
| A role change did not take effect       | The user's token is still valid                     | They must sign in again (`session_version` was bumped) |
| The user list shows zeros               | The request is still loading                        | The page now shows a skeleton, not "No users match"    |
| A suspended user can still call the API | They cannot — `auth()` refuses suspended everywhere | Check they are really suspended                        |
| The audit log is empty                  | No admin action has run yet                         | It fills as you use the panel                          |

## 11. Related Code

- `apps/web/app/admin/users/`, `requests/`, `audit-log/`
- `apps/api/src/routes/admin.ts`
- `apps/api/src/controllers/admin-users.ts`
- `apps/api/src/lib/audit.ts`
- [Authentication](./authentication.md)
