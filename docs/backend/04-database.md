# Database

**Purpose:** understand what is stored, how the tables relate, and who is
allowed to change what.

The schema is defined in **`apps/api/src/db/schema.ts`** — one file, 26 tables.
That file is the source of truth; migrations are generated from it.

---

## 1. How data moves

```text
Frontend (browser)
      │  HTTP
      ▼
API route
      │
      ▼
Controller          ← business rules, permissions
      │
      ▼
db/queries/*.ts     ← the SQL
      │
      ▼
Drizzle ORM
      │
      ▼
PostgreSQL
```

The web app has **no** database code. It cannot reach Postgres directly.

---

## 2. The tables at a glance

| Group             | Tables                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| **People**        | `users`, `guardianships`, `student_subjects`                                         |
| **Catalogue**     | `boards`, `levels`, `subjects`, `courses`, `books`, `book_courses`, `materials`      |
| **Access**        | `access_requests`, `access_request_subjects`, `parent_invites`                       |
| **Teaching**      | `classes`, `enrollments`, `teacher_courses`, `assignments`, `submissions`, `quizzes` |
| **Attendance**    | `attendance_sessions`, `attendance_records`                                          |
| **Money**         | `invoices`                                                                           |
| **Communication** | `meetings`, `support_tickets`, `ticket_messages`                                     |
| **Audit**         | `audit_logs`                                                                         |

---

## 3. The relationships

```text
boards ──┐
levels ──┼──▶ courses ◀── teacher_courses ──▶ users (teacher)
subjects ┘        │
                  ├──▶ book_courses ──▶ books
                  ├──▶ materials
                  ├──▶ classes ──▶ enrollments
                  └──▶ assignments ──▶ submissions

users (student) ──▶ enrollments ◀── users (teacher)
users (student) ──▶ student_subjects ──▶ subjects
users (student) ◀──▶ users (parent)      via guardianships
users (student) ──▶ parent_invites ──▶ users (parent, on redeem)
users ──▶ access_requests ──▶ access_request_subjects
users ──▶ invoices
users ──▶ meetings (parent, teacher, student)
users ──▶ support_tickets ──▶ ticket_messages
users ──▶ audit_logs
```

---

## 4. The important tables

### `users` — every account

The centre of the system. One row per person, whatever their role.

| Field                  | Meaning                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | UUID primary key                                                                                                                         |
| `clerk_id`             | A unique identity string. **Historical name** — it is generated locally now (`local-<email>-<timestamp>`), not by any external provider. |
| `email`                | Lowercase, unique (enforced by a CHECK)                                                                                                  |
| `password_hash`        | scrypt hash. Null only for accounts created before local auth.                                                                           |
| `role`                 | `super_admin`, `admin`, `teacher`, `student`, `parent`, or null                                                                          |
| `status`               | `pending`, `active`, `rejected`, `suspended`                                                                                             |
| `onboarded`            | A student is not usable until a parent is linked                                                                                         |
| `session_version`      | Bumped to invalidate every existing token                                                                                                |
| `board_id`, `level_id` | A student's board and level                                                                                                              |

**Who creates it:** sign-up, or the super-admin seed.
**Who modifies it:** admins (role, status), the user (password), the system
(`session_version`).
**Who reads it:** the owner (`/me`), admins (user list).

> **Why `clerk_id` is still called that:** the column predates local
> authentication. Renaming it needs a migration and touches every query, so it
> was left alone. Treat it as "the account's stable identity string".

### `access_requests` — the approval queue

One row per request to join.

| Field                                | Meaning                        |
| ------------------------------------ | ------------------------------ |
| `user_id`                            | Who is asking                  |
| `requested_role`                     | What they asked for            |
| `state`                              | `open`, `approved`, `rejected` |
| `decided_by`, `decided_at`, `reason` | The decision                   |

A **partial unique index** allows only one `open` request per user.

**Who creates it:** the applicant (`POST /me/request`).
**Who modifies it:** an admin (the decision).

### `guardianships` — parent ↔ student

A join table with a composite primary key, so the same link cannot exist twice.

| Field        | Meaning      |
| ------------ | ------------ |
| `student_id` | The child    |
| `parent_id`  | The guardian |

A CHECK prevents a user being their own guardian.

**Who creates it:** the parent, by redeeming a link code.

### `parent_invites` — link codes

| Field        | Meaning                                  |
| ------------ | ---------------------------------------- |
| `student_id` | Who issued it                            |
| `code`       | 8 characters, uppercase, no lookalikes   |
| `state`      | `sent`, `accepted`, `revoked`, `expired` |
| `expires_at` | 14 days                                  |
| `attempts`   | Failed redemptions, incremented in SQL   |

**Who creates it:** the student (the onboarding step).
**Who redeems it:** the parent.

### `courses` — a board + level + subject

The catalogue's core. A course is one subject taught at one level under one
board.

| Field                                | Meaning                             |
| ------------------------------------ | ----------------------------------- |
| `board_id`, `level_id`, `subject_id` | The three parts                     |
| `medium`                             | Optional (e.g. English/Urdu medium) |
| `active`                             | Whether it can be chosen            |

A unique index on all four (with `NULLS NOT DISTINCT`) prevents duplicates.

**Who creates it:** an admin, or the catalogue seed.

### `enrollments` — a student in a teacher's course

| Field                                   | Meaning                                    |
| --------------------------------------- | ------------------------------------------ |
| `student_id`, `teacher_id`, `course_id` | The three parties                          |
| `class_id`                              | Optional: which class                      |
| `state`                                 | `requested`, `active`, `declined`, `cancelled`, `ended` |

**Who creates it:** the student (requests a teacher).
**Who modifies it:** the teacher (accept/decline), an admin (reassign).

### `classes` — a teacher's group

| Field                     | Meaning           |
| ------------------------- | ----------------- |
| `teacher_id`, `course_id` | Who teaches what  |
| `name`, `schedule`        | Display           |
| `state`                   | `current`, `past` |

### `assignments` and `submissions`

An assignment belongs to a course and a teacher. A submission belongs to an
assignment and a student. A unique index stops a student submitting twice.

### `attendance_sessions` and `attendance_records`

A session is one day for one class (or one enrollment). A record is one
student's presence. The composite key `(session_id, student_id)` prevents
duplicates.

### `invoices`

| Field        | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `student_id` | Who owes                                                 |
| `period`     | e.g. "2026-01"                                           |
| `amount`     | `numeric(12,2)` — **not** a float, so money never rounds |
| `state`      | `unpaid`, `paid`                                         |

**Who creates it:** an admin.
**Who reads it:** the student, their parents, admins.

### `audit_logs`

| Field                      | Meaning                                           |
| -------------------------- | ------------------------------------------------- |
| `actor_id`                 | Who did it (no cascade — history survives)        |
| `action`                   | e.g. `assignRole`                                 |
| `target_type`, `target_id` | What was changed (deliberately not a foreign key) |
| `before`, `after`          | JSON snapshots                                    |

**Who creates it:** the API, on every admin action.

---

## 5. Who can access what

| Data         | Student | Parent            | Teacher      | Admin |
| ------------ | ------- | ----------------- | ------------ | ----- |
| Own profile  | ✓       | ✓                 | ✓            | ✓     |
| Own children | —       | ✓ (linked only)   | —            | ✓     |
| Own students | —       | ✓ (enrolled only) | ✓            |
| All users    | —       | —                 | —            | ✓     |
| Catalogue    | read    | read              | read + write |
| Own invoices | ✓       | ✓ (children)      | —            | ✓     |
| Audit log    | —       | —                 | —            | ✓     |

> **The API enforces this, not the UI.** The web guards only decide which page
> to show; every rule above is a `requireRole` in a route or an ownership check
> in a controller.

---

## 6. Migrations

Migrations are SQL files in `apps/api/src/db/migrations/`, applied in order.

```bash
# after editing schema.ts
bun run --cwd apps/api db:generate   # writes a new .sql file
# READ IT — check it does not drop and recreate
bun run --cwd apps/api db:migrate
```

> **Why generate instead of writing SQL by hand?** Drizzle derives the migration
> from the difference between `schema.ts` and the last migration. Hand-written
> SQL drifts from the schema, and the next `db:generate` then produces a
> migration that undoes your work.

### The migration runner

`db:migrate` runs `scripts/db-migrate.ts`, which retries a few times on a
connection error. A hosted database that is waking up should not fail a deploy;
a real SQL error still fails immediately.

---

## 7. Seeding

| Script             | What it adds                                  |
| ------------------ | --------------------------------------------- |
| `seed:super-admin` | The first super admin (creates or reconciles) |
| `seed:catalog`     | 5 boards, 7 levels, 14 subjects, 214 courses  |
| `seed:dev`         | Development fixtures                          |

All are idempotent. There is also a plain SQL version of the catalogue seed at
`apps/api/src/db/seed-catalog.sql`.

---

## 8. Adding a table

1. Add the `pgTable` to `schema.ts`.
2. Add its name to the `TABLES` list in `apps/api/tests/helpers.ts`, or the test
   reset will leave rows behind.
3. `bun run --cwd apps/api db:generate` and read the SQL.
4. `bun run --cwd apps/api db:migrate`.
5. Write queries in `db/queries/`.
6. Write the controller and route.

---

## 9. Related

- [Controllers](./03-controllers.md)
- [Routes](./02-routes.md)
- [Authentication](./05-authentication.md)

---

## Files this document was based on

- `apps/api/src/db/schema.ts` — all 26 tables
- `apps/api/src/db/index.ts` — the connection
- `apps/api/src/db/queries/` — the SQL
- `apps/api/src/db/migrations/` — the applied SQL
- `apps/api/scripts/db-migrate.ts`, `seed-catalog.ts`, `seed-super-admin.ts`
- `apps/api/tests/helpers.ts` — the table reset list
