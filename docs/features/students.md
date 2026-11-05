# Students

## 1. What is it?

A student's account and everything they do: joining courses, submitting work,
seeing attendance, fees and materials — plus the guardian link that makes the
account usable.

## 2. Who uses it?

Students, and the admins who approve and manage them.

## 3. User Flow

```text
Sign up → request access → admin approves
        → /onboarding/parent: create a link code
        → a parent redeems it
        → /student: the panel opens
```

Inside the panel:

```text
/student/teachers   → request a teacher for a course
/student/assignments → submit work
/student/attendance  → see the record
/student/invoices    → see fees
/student/guardians   → see or revoke guardian links
```

## 4. Frontend

| File                               | What it shows           |
| ---------------------------------- | ----------------------- |
| `app/student/layout.tsx`           | The panel frame + guard |
| `app/student/page.tsx`             | Dashboard               |
| `app/student/teachers/page.tsx`    | Teachers to request     |
| `app/student/assignments/page.tsx` | Work and submissions    |
| `app/student/attendance/page.tsx`  | Attendance              |
| `app/student/courses/page.tsx`     | Enrolled courses        |
| `app/student/books/page.tsx`       | Books                   |
| `app/student/materials/page.tsx`   | Materials               |
| `app/student/quizzes/page.tsx`     | Quizzes                 |
| `app/student/invoices/page.tsx`    | Fees                    |
| `app/student/guardians/page.tsx`   | Guardian links          |
| `app/student/support/page.tsx`     | Support tickets         |
| `app/student/student-forms.tsx`    | The mutation forms      |
| `app/onboarding/parent/page.tsx`   | The guardian step       |

## 5. API

| Method | Path                               | What it does             |
| ------ | ---------------------------------- | ------------------------ |
| `GET`  | `/student/courses`                 | Enrolled courses         |
| `GET`  | `/student/assignments`             | Assignments              |
| `GET`  | `/student/attendance`              | Attendance               |
| `GET`  | `/student/grades`                  | Grades                   |
| `GET`  | `/student/books`                   | Books                    |
| `GET`  | `/student/materials`               | Materials                |
| `GET`  | `/student/quizzes`                 | Quizzes                  |
| `GET`  | `/student/teachers`                | Teachers to request      |
| `POST` | `/student/enrollments`             | Request a teacher/course |
| `POST` | `/student/submissions`             | Submit an assignment     |
| `GET`  | `/student/guardians`               | Linked guardians         |
| `POST` | `/student/parent-links`            | Create a link code       |
| `POST` | `/student/parent-links/:id/revoke` | Cancel a code            |

## 6. Backend

| File                      | What it does                |
| ------------------------- | --------------------------- |
| `routes/panels.ts`        | The student routes          |
| `controllers/student.ts`  | The student panel data      |
| `controllers/teaching.ts` | Enrollments and submissions |
| `controllers/parent.ts`   | Link codes                  |
| `db/queries/`             | The SQL                     |

## 7. Database

| Table                | What it holds                                                         |
| -------------------- | --------------------------------------------------------------------- |
| `users`              | The account (`role = 'student'`, `onboarded`, `board_id`, `level_id`) |
| `student_subjects`   | The subjects they chose                                               |
| `enrollments`        | Their teacher/course links                                            |
| `submissions`        | Their submitted work                                                  |
| `attendance_records` | Their attendance                                                      |
| `guardianships`      | Their linked parents                                                  |
| `parent_invites`     | Their link codes                                                      |
| `invoices`           | Their fees                                                            |

## 8. Permissions

| Action               | Who                                  |
| -------------------- | ------------------------------------ |
| See their own data   | the student                          |
| See a student's data | their teacher, their parents, admins |
| Request a teacher    | the student                          |
| Accept a request     | the teacher                          |
| Create a link code   | the student                          |
| Approve the account  | an admin                             |

> **A student cannot reach any student endpoint until `onboarded` is true.** The
> gate returns `403` and the app sends them to `/onboarding/parent`.

## 9. Common Changes

### Add a field to the student profile

1. Add the column to `users` in `schema.ts` (or a new table if it is a list).
2. `db:generate` + `db:migrate`.
3. Return it from `controllers/student.ts`.
4. Show it on the page.

### Change what a student can request

`controllers/teaching.ts` → `requestEnrollment`. The rules (one open request at
a time, course must match their board/level) live there.

### Change the onboarding step

`app/onboarding/parent/page.tsx` and `parent-form.tsx`. The API side is
`controllers/parent.ts` → `createParentLink`.

## 10. Troubleshooting

| Symptom                                            | Cause                              | Fix                                                         |
| -------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Student stuck on `/onboarding/parent`              | No guardian linked                 | Create a code and redeem it as a parent                     |
| `403 "Account needs onboarding"`                   | `onboarded` is false               | Same                                                        |
| `403` on `POST /student/parent-links`              | The route lost `allowRestricted`   | Restore `auth({ allowRestricted: true })`                   |
| "You already have the maximum number of guardians" | 5 links exist                      | Revoke one                                                  |
| "That email already has an account"                | The parent signed up already       | They should redeem the code from their own panel            |
| No teachers to request                             | No courses match their board/level | Check the catalogue and the student's `board_id`/`level_id` |

## 11. Related Code

- `apps/web/app/student/`
- `apps/api/src/routes/panels.ts`
- `apps/api/src/controllers/student.ts`, `teaching.ts`, `parent.ts`
- [Authentication](./authentication.md)
