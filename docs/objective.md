# Fastly LMS: Project Objective

**Version 3.0 · 2026-10-31 · Single source of truth**

This file defines what we are building and how. The project starts from scratch, so nothing here describes older code. If the code and this file disagree, one of them is wrong. Fix it in the same pull request, and change this file first when the decision changes.

Repo: `Hsk4/student_lms_3` · Stack: Next.js 16 (App Router, static export) web · Express 5 API · Clerk · PostgreSQL with Drizzle · Capacitor (Android) · shadcn/ui · Tailwind v4 · bun workspaces

---

## 1. Goal

A single-school learning platform for students, parents and teachers, run by admins. Five roles. Nobody picks their own role: every new account waits for an admin, and every record is reachable only through its owner.

### Done when all of these are true

- [ ] No user gets a role except through admin approval. The super admin is created by script only.
- [ ] No Clerk Organizations and no tenant ids anywhere. One school.
- [ ] Boards, levels, subjects, courses and books are admin-managed data, not hard-coded lists.
- [ ] Student flow works end to end: request, approval, parent details, pick teacher, teacher accepts, class or one-on-one.
- [ ] A parent sees only their linked children. A teacher sees only their own students. A student sees only themselves. This is enforced on the server and covered by tests.
- [ ] Every admin action that changes a role, status, teacher or board is written to the audit log.
- [ ] `bun run build`, `bun run lint` and `bun run lint:colors` pass with zero unused files and zero mock data in app code.
- [ ] This file is accurate, and `README.md` points to it.

### Out of scope

Online payments, book sales, multiple schools, native mobile apps, live video classes, chat between users.

---

## 2. Roles and statuses

One role per user.

| Role | Purpose |
|---|---|
| `super_admin` | Owns the school account. Manages admins. Receives escalated tickets. |
| `admin` | Approves sign-ups, assigns roles, manages catalog, teachers, invoices, reassignments. Cannot change the super admin or other admins. |
| `teacher` | Teaches assigned courses. Accepts students, runs classes, sets and grades work. |
| `student` | Picks a teacher, attends, submits work, sees fees. |
| `parent` | Links to their child with a code, then a read-only view of progress and fees. Can request meetings. |

| Status | Meaning | Can reach |
|---|---|---|
| `pending` | Signed up, no decision yet. No role. | `/pending`, `/request` |
| `active` | Approved. | The area for their role |
| `rejected` | Declined by an admin. | `/rejected`. May re-apply 30 days after `rejectedAt`. |
| `suspended` | Blocked by an admin. | Nothing. Redirect to `/?error=account_suspended`. |

A student who is `active` but not `onboarded` can reach only `/onboarding/parent`.

Allowed status changes:

| From | To | Who | How |
|---|---|---|---|
| (new) | `pending` | system | Clerk webhook |
| `pending` | `active` | admin | Assign a role |
| `pending` | `rejected` | admin | Reject with a reason |
| `rejected` | `pending` | the user | Re-apply after 30 days (new access request) |
| `active` | `suspended` | admin | Suspend |
| `suspended` | `active` | admin | Reinstate |
| (approved) | `active` | the parent | Redeem the child's link code. Role is `parent` and the link is written. |

---

## 3. Decisions

| Topic | Decision |
|---|---|
| Tenancy | One school. No organizations. |
| Source of truth for role and status | Clerk `publicMetadata`: `role`, `status`, `onboarded`. Verified by the API from the session token. Mirrored into the `users` table by webhook. |
| Missing metadata | Treated as `pending`. |
| Boards | Real exam boards only (Sindh, Aga Khan and so on). Qualifications such as O Level are levels, not boards. |
| Levels | A flat admin-managed list with an order. Which levels exist for which board is expressed by which courses exist. |
| Course | One board, one level, one subject, optional medium. Unique on that combination. |
| Books | Recommended courseware only. Students buy them themselves. No prices, no payments. |
| Past papers | No separate model. A `Material` with type `past_paper`. |
| Payments | Tuition invoices only. Amounts are whole PKR, stored as integers. Admin marks paid. |
| Parents | The student issues an 8-character link code (`parent_invites`, 14-day expiry, one use) and shares it themselves. The parent signs up, asks for parent access, is approved by an admin, then enters the code under **Link a child**; that writes the `guardianships` row. No email is sent and Clerk invitations are not used. |
| Enrollment | `requested`, then `active` when the teacher accepts (with or without a class), or `declined`. Later `cancelled` or `ended`. |
| Grades | Numeric, 0 to 100, plus optional feedback text. |
| Rejected users | May re-apply after 30 days. |
| Time | Store UTC. Show Asia/Karachi. |
| Mock data | None in app code. Dev data comes from `apps/api/scripts/seed-dev.ts` only. |

---

## 4. Stack and conventions

- **Architecture:** one API (`apps/api`, Express 5) owns all data and rules; one web client (`apps/web`, Next.js static export) and the Capacitor app are clients of it. See `ARCHITECTURE-REFACTOR.md`.
- **Auth:** Clerk. The web signs in with `@clerk/clerk-react` and sends `Authorization: Bearer <session token>`; the API verifies it with `@clerk/backend` and reads role/status from the mirrored `users` row.
- **Gate:** the API is the gate. Routes carry `requireRole(...)`; controllers check record ownership. The web's client guards are UX only and mirror the old redirects.
- **Validation:** zod (from `packages/shared`) on every API input.
- **Mutations:** `POST`/`PATCH`/`DELETE` endpoints under `/api/v1`. Each controller validates, checks ownership, and writes its audit entry in the same transaction.
- **Data access:** Drizzle queries in `apps/api/src/db/queries/*` used by controllers (routes -> controllers -> db). The web has no database access.
- **Transactions:** `db.transaction(async (tx) => ...)` for anything that changes more than one record, such as reassignment or role change plus audit entry.
- **Files:** store a URL only (`fileUrl`). Provider is an open question (section 12).
- **Naming:** files in kebab-case, components in PascalCase, models singular.
- **Commits:** one commit per phase step. Run `bun run build` before each phase merge.

Database setup: `DATABASE_URL` (pooled) is what the API connects with, `DATABASE_URL_UNPOOLED` is what `drizzle-kit migrate` uses. Migrations live in `apps/api/src/db/migrations/` and are generated offline with `bun run db:generate` in `apps/api`; review the SQL before `bun run db:migrate`. Postgres 15+ is required (`NULLS NOT DISTINCT` on the course uniqueness rule).

---

## 5. Domain model

Baseline schema. Fields are the minimum needed. Add fields here before adding them in code.

### Identity

**User**
`clerkId` (unique), `email`, `name`, `role` (nullable), `status` (default `pending`), `onboarded` (bool), `rejectedAt`, `rejectionReason`,
`student: { boardId, levelId, subjectIds[], guardianIds[] }`,
`teacher: { courseIds[] }`, timestamps.

**AccessRequest**
`userId`, `name`, `email`, `boardId`, `levelId`, `subjectIds[]`, `note`, `state` (`open` | `approved` | `rejected`), `decidedBy`, `decidedAt`, `reason`.

**ParentInvite**
`studentId`, `parentName`, `parentEmail`, `clerkInvitationId`, `state` (`sent` | `accepted` | `expired` | `revoked`), `expiresAt`, `acceptedBy`, `acceptedAt`.

**AuditLog** (append only)
`actorId`, `action`, `targetType`, `targetId`, `before`, `after`, `at`.

### Catalog

**Board** `name`, `slug`, `active` · **Level** `name`, `order`, `active` · **Subject** `name`, `slug`, `active`

**Course** `boardId`, `levelId`, `subjectId`, `medium` (optional), `active`. Unique on board, level, subject, medium.

**Book** `title`, `author`, `courseIds[]`, `note`. No price.

**Material** `courseId`, `title`, `type` (`notes` | `past_paper` | `worksheet` | `other`), `fileUrl`, `uploadedBy`.

### Teaching

**Enrollment** `studentId`, `teacherId`, `courseId`, `classId` (optional), `state` (`requested` | `active` | `declined` | `cancelled` | `ended`), `requestedAt`, `decidedAt`, `endReason`.

**Class** `teacherId`, `courseId`, `name`, `schedule`, `state` (`current` | `past`), `startsOn`, `endsOn`.

**Assignment** `courseId`, `teacherId`, exactly one of `classId` or `enrollmentId`, `title`, `description`, `dueAt`.

**Submission** `assignmentId`, `studentId`, `text`, `fileUrl`, `submittedAt`, `score` (0 to 100), `feedback`, `gradedBy`, `gradedAt`. Unique on assignment and student.

**Attendance** `classId` or `enrollmentId`, `date`, `records[{ studentId, present }]`.

### Money and support

**Invoice** `studentId`, `period` (for example `2026-11`), `amount` (integer PKR), `dueDate`, `state` (`unpaid` | `paid` | `void`), `paidAt`, `markedBy`.

**Meeting** `parentId`, `teacherId`, `studentId`, `requestedSlots[]`, `confirmedAt`, `state` (`requested` | `confirmed` | `rescheduled` | `cancelled` | `done`).

**SupportTicket** `createdBy`, `subject`, `messages[]`, `state` (`open` | `escalated` | `resolved`), `assignedTo` (`admin` | `super_admin`).

**Quiz** (Phase 7) fields are defined when that phase starts.

### Relationships

| From | To | Shape | Meaning |
|---|---|---|---|
| Parent user | Student user | many to many via `guardianIds` | A parent can follow several children. |
| Student user | ParentInvite | one to many | The student sends invites. |
| User | AccessRequest | one to many | One open request at a time. |
| Admin user | AuditLog | one to many | Actor of every logged action. |
| Teacher user | Course | many to many via `courseIds` | Courses they teach. |
| Course | Board, Level, Subject | many to one each | |
| Book | Course | many to many | Recommended for these courses. |
| Material | Course | many to one | |
| Enrollment | Student, Teacher, Course | many to one each | Teacher access to a student requires an active one. |
| Enrollment | Class | many to zero or one | No class means one-on-one. |
| Assignment | Class or Enrollment | many to one | |
| Submission | Assignment, Student | many to one each | |
| Invoice | Student | many to one | Visible to the student and their parents. |
| Meeting | Parent, Teacher, Student | many to one each | |
| SupportTicket | User | many to one | |

---

## 6. Auth and access design

**Claims.** Set once in the Clerk dashboard: the session token includes `{ "metadata": "{{user.public_metadata}}" }`.

**Webhook** at `<api>/webhooks/clerk`. Verify the signature with Clerk's signing secret (raw body, mounted before the JSON parser). Handlers are idempotent.
- `user.created`: create the user as `pending` with no role. A parent is activated by admin approval, not by the webhook.
- `user.updated` and `user.deleted`: keep the mirror in sync.

**Seed.** `apps/api/scripts/seed-super-admin.ts` takes an email, checks that the Clerk account exists and its email is verified, then sets `role: super_admin`, `status: active` in both Clerk and Postgres. `seed-dev.ts` also mirrors any Clerk account whose webhook never landed as a normal `pending` row, so local testing without a tunnel still reaches the admin queue.

**Admin actions.** `assignRole`, `rejectUser`, `suspendUser`, `reinstateUser`. Each one commits Postgres (including the audit row) in a transaction, then updates Clerk metadata; if Clerk fails, the Postgres half is undone in a compensating transaction. Admins cannot act on `super_admin` or other admins. Changing a user away from teacher or student first lists and cancels their open enrollments.

**Fresh reads.** Role and status come from the Postgres mirror on every request, not from cached claims, so a role change takes effect on the next call. The pending page polls `GET /me` every 5 seconds and moves on when the status changes.

**Panel guards (coarse).** Called at the top of each panel's layout.

| Area | Roles |
|---|---|
| `/admin/**` | admin, super_admin |
| `/admin/admins/**` | super_admin only |
| `/teacher/**` | teacher |
| `/student/**` | student |
| `/parent/**` | parent |
| `/pending`, `/request` | status pending |
| `/rejected` | status rejected |
| `/onboarding/parent` | active student, not onboarded |

**Row guards (fine).** Called in every action and page that reads or writes a record.

| Guard | Passes when |
|---|---|
| `requireRole([...])` | The user has one of the roles and is active. |
| `requireTeacherOf(studentId)` | An active enrollment exists for this teacher and student. |
| `requireParentOf(studentId)` | The student is in this parent's linked children. |
| `requireEnrollmentAccess(id)` | The user is the student, their teacher, their parent, or an admin. |

Rule: **the panel guard gates the area, the row guard gates the record.** Never rely on one alone. Any new way of reading data adds a row guard and a test.

**Rate limits.** The webhook and the AI quiz endpoints.

---

## 7. Panels

Route names are fixed. Sidebar entries match the list order.

### Public and gate pages
`/` landing · `/sign-in` · `/sign-up` · `/sign-up/parent` · `/request` access form (name, email, board, level, subjects) · `/pending` waiting page with 3-step tracker and polling · `/rejected` with reason and re-apply date · `/invite` (explains that parents now link by code) · `/onboarding/parent` student creates a link code.

### Admin
Requests · Users · Boards · Courses · Books · Invoices · Tickets · Audit log · Analytics. Levels and subjects are tabs on the Courses page.
- Approve with a role or reject with a reason (`/admin/requests`).
- Suspend, reinstate, view a user (`/admin/users`, `/admin/users/[id]`).
- Create boards, levels, subjects, courses and recommended books.
- Edit a teacher's `courseIds`. Reassign a student to another teacher, and change a student's board or books. Mismatched enrollments are listed and cancelled in one transaction.
- Create and mark invoices.
- Answer tickets, escalate to the super admin.
- Analytics are built from Postgres, never from the Clerk API.

### Super admin
Everything above, plus **Admins** (`/admin/admins`): create, suspend and reinstate admins. Receives escalated tickets.

### Teacher
Requests · Students · Classes · Assignments · Meetings · Support.
- Accept or decline student requests. On accept, choose a class or one-on-one.
- Publish assignments for a class or one student. Grade submissions.
- Take attendance. See current and previous batches.
- Confirm or reschedule parent meetings.

### Student
My courses · Teachers · Assignments · Invoices · Books · Quizzes (Phase 7) · Support.
- First login: add a parent (name and email) before anything else.
- Pick a teacher from those who teach a course matching the student's board and level.
- Submit assignments, see grades.
- See fees due and recommended books.

### Parent
Children · Invoices · Meetings.
- Child switcher. Per child: attendance, latest grades, upcoming meeting, current invoice. Read-only.
- Request a meeting with the teacher.

---

## 8. Core flows

**1. Sign-up to linked parent**
1. User signs up. The webhook creates the user as `pending` with no role.
2. User fills `/request`. An `AccessRequest` is created.
3. Admin assigns a role (status `active`) or rejects with a reason. Audit entry written.
4. An active student creates a link code (`ParentInvite`, 14 days, one use) and shares it themselves.
5. The parent signs up, asks for parent access, is approved, then enters the code under **Link a child**. The server claims the code atomically, writes the `guardianships` row, and marks the student onboarded.

**2. Student to teacher**
1. Student sees teachers whose `courseIds` match their board and level.
2. Student requests one. An `Enrollment` is created as `requested`.
3. Teacher accepts (with a class or one-on-one) and it becomes `active`, or declines.
4. Admin can move the student: the old enrollment is cancelled, a new one created, and an audit entry written, all in one transaction.

**3. Teaching loop**
1. Teacher publishes an `Assignment`.
2. Student sends a `Submission`. The server checks the student is enrolled before accepting.
3. Teacher grades. The student sees the result.
4. Parent sees progress read-only. Admin raises an `Invoice` and marks it paid.

---

## 9. Design system: Nila

White pages, one cobalt blue, one navy sidebar. Calm and modern. No gradients, no glass blur, no glows, no purple, pink or orange accents.

| Token | Value | Use |
|---|---|---|
| Background | `#FFFFFF` | Pages, cards |
| Secondary surface | `#F5F8FE` | Table headers, quiet panels |
| Text | `#0B1B3A` / `#4A5878` | Primary / secondary |
| Primary | `#1E4DB7` (hover `#173D94`) | Actions, links |
| Tint | `#EEF3FF` (text `#173D94`) | Hover, selected rows |
| Navy | `#0D2252` | Sidebar only |
| Firoza | `#0B7F8F` | Sparing accent, second chart series |
| Border | `#E2E8F4` | Dividers. Form fields use `#7F90B5`. |
| Status | green `#146C3A`, amber `#8A4B08`, red `#A32A1C` on soft fills | Status chips only |

Rules:
- Type is Geist, headings semibold with tight tracking, numbers tabular. Add Noto Nastaliq Urdu as a fallback for Urdu text.
- Radius 10 to 12px on cards and buttons. Cards are a 1px border with no shadow. Shadow only on floating elements.
- Hover changes colour only, over 150ms. No scaling.
- One motif: a faint eight-point star pattern, stroke only, on the navy sidebar.
- Role chips: `super_admin` solid navy, `admin` solid blue, `teacher` tint, `student` blue outline, `parent` dashed outline.
- Use only semantic token classes (`bg-background`, `text-primary`, `border-border`). Raw palette colours and `bg-gradient`, `backdrop-blur` are forbidden. `bun run lint:colors` enforces this:

```
grep -rEn "(pink|purple|fuchsia|violet|rose|indigo|cyan|emerald|teal|amber|lime|sky)-[0-9]{2,3}|bg-gradient|backdrop-blur" app components lib
```
- Use logical spacing classes (`ps-4`, `ms-2`, `text-start`) so right-to-left Urdu views stay possible.

---

## 10. Repository layout

```
apps/
  api/             Express 5
    src/db/        schema.ts  migrations/  queries/   (the M in MVC)
    src/routes/    me  admin  catalog  panels  webhooks
    src/controllers/  one file per domain
    src/middleware/   auth, require-role, error handler
    src/lib/       audit.ts  link-codes.ts  ownership.ts  clerk.ts
    scripts/       seed-dev.ts  seed-super-admin.ts
    tests/         vitest + supertest (auth, isolation, parent links)
  web/             Next.js 16, static export
    app/           routes; thin client pages
    views/         layout/ (root shell, signed-in redirect)
    components/    ui/ (shadcn)  shell/ (sidebar, header)  shared/
    lib/           api-client.ts  queries.ts  guards.tsx
    android/       Capacitor project
    public/
packages/
  shared/          validators, roles/status, API types
qa/                QA screenshots
docs/              this file, migration-plan.md
```

Environment variables (each app's `.env.example` is committed, real values are not). API: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `WEB_ORIGIN`, `PORT`. Web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. File storage and AI provider keys are added when those are chosen.

---

## 11. Build phases

Each phase ends with a passing build, passing authorization tests for its guards, and a manual check. Tick boxes as you go.

### Phase 0: Foundation
- [ ] Scaffold the app, add Nila tokens to `globals.css`, shadcn components restyled by tokens. [skip initially]
- [ ] `lib/db.ts` (cached connection, `withTransaction`), `.env.example`, `lint:colors` script.
- [ ] Clerk configured: session claim template, webhook endpoint registered.
- [ ] Shell components: sidebar, header, role chip, status chip. [skip initially]
- [ ] Make script to seed super admins. - [ ] `scripts/seed-super-admin.ts`.
- **Done when:** the app builds, a signed-in user sees an empty page in the shell, and lint passes.

### Phase 1: Identity and approval
- [ ] Models: `User`, `AccessRequest`, `AuditLog`.
- [ ] Webhook (create, update, delete). `lib/auth/roles.ts` and `guards.ts` with `requireRole`.
- [ ] `/request`, `/pending` (polling), `/rejected`.
- [ ] Admin: requests queue, users list, `assignRole`, `rejectUser`, `suspendUser`, `reinstateUser`, each with an audit entry.

- **Done when:** a fresh sign-up reaches no panel until an admin assigns a role, and the audit log shows the change.

### Phase 2: Catalog
- [ ] Models: `Board`, `Level`, `Subject`, `Course`, `Book`, `Material`.
- [ ] Admin pages for boards, courses (with level and subject tabs) and books, each with list and detail.
- **Done when:** an admin creates a board, level, subject, course and recommended books with no code change.

### Phase 3: Student onboarding and parents
- [ ] `/onboarding/parent` creates a `ParentInvite` with an 8-character code (14-day expiry, one use).
- [ ] The parent redeems the code from their panel; the server claims it atomically, writes the `guardianships` row, and marks the student onboarded.
- [ ] Parent panel shell. `isGuardianOf` ownership checks and their tests.
- **Done when:** request, approval and link-code parent linking work with two test accounts.

### Phase 4: Teacher matching and classes
- [ ] Teacher `courseIds`, editable by admin.
- [ ] Student teacher picker filtered by board and level.
- [ ] `Enrollment` lifecycle and `Class`. `requireTeacherOf`, `requireEnrollmentAccess` and tests.
- [ ] Admin reassignment (one transaction, audited). Admin board and book changes cancel mismatched enrollments.
- **Done when:** a student gets a teacher, in a class or one-on-one, and an admin can move them to another teacher.

### Phase 5: Teaching tools
- [ ] `Assignment`, `Submission`, grading, `Attendance`, current and previous batches.
- **Done when:** a teacher publishes, a student submits, the teacher grades, and the student sees the result.

### Phase 6: Parent views, tuition, meetings, support
- [ ] Parent children list and per-child progress, read-only.
- [ ] `Invoice`: admin creates and marks paid. Student and parent see dues.
- [ ] `Meeting`: parent requests, teacher confirms or reschedules.
- [ ] `SupportTicket`: student or teacher to admin, escalatable to super admin.
- **Done when:** a parent sees only their own children's data, checked with a second parent account.

### Phase 7: Quizzes, analytics, hardening
- [ ] Material upload. AI quiz generation scoped to the student's enrolled courses.
- [ ] Admin analytics built from Postgres.
- [ ] Rate limits on webhook and AI routes.
- [ ] Full pass over authorization tests, accessibility (focus rings, contrast) and phone-width layouts.
- **Done when:** every item in section 1 is ticked.

---

## 12. Open questions

| Question | Default until decided |
|---|---|
| Where are uploaded files stored (materials, submissions)? | Object storage with signed URLs. Provider not chosen. |
| How are parent invite emails sent? | Not sent: the student shares the link code with the parent directly. No transactional email provider is configured. |
| Which AI provider generates quizzes? | Not chosen. Decide before Phase 7. |
| What are the allowed values for course `medium`? | Free text, admin-managed later if needed. |
| Is there a cap on guardians per student? | No cap. |
| Do we ship Urdu screens at launch? | No. Keep styles right-to-left ready. |
