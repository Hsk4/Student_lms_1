# Teachers

## 1. What is it?

A teacher's account and their work: accepting students, running classes, taking
attendance, setting and grading assignments, and meeting parents.

## 2. Who uses it?

Teachers, and the admins who approve them and assign their courses.

## 3. User Flow

```text
Sign up → request access → admin approves (role = teacher)
        → /teacher
```

Inside the panel:

```text
/teacher/requests    → accept or decline a student's request
/teacher/classes     → create a class, mark it finished
/teacher/attendance  → record who was present
/teacher/assignments → set work, grade submissions
/teacher/meetings    → confirm or reschedule parent meetings
```

## 4. Frontend

| File                                   | What it shows           |
| -------------------------------------- | ----------------------- |
| `app/teacher/layout.tsx`               | The panel frame + guard |
| `app/teacher/page.tsx`                 | Dashboard               |
| `app/teacher/students/page.tsx`        | The teacher's students  |
| `app/teacher/students/detail/page.tsx` | One student             |
| `app/teacher/classes/page.tsx`         | Classes                 |
| `app/teacher/classes/detail/page.tsx`  | One class               |
| `app/teacher/attendance/page.tsx`      | Attendance              |
| `app/teacher/assignments/page.tsx`     | Assignments and grading |
| `app/teacher/meetings/page.tsx`        | Meetings                |
| `app/teacher/requests/page.tsx`        | Enrollment requests     |
| `app/teacher/support/page.tsx`         | Support tickets         |
| `app/teacher/teacher-forms.tsx`        | The mutation forms      |

## 5. API

| Method | Path                                 | What it does                |
| ------ | ------------------------------------ | --------------------------- |
| `GET`  | `/teacher/dashboard`                 | Dashboard numbers           |
| `GET`  | `/teacher/students`                  | The teacher's students      |
| `GET`  | `/teacher/requests`                  | Pending enrollment requests |
| `POST` | `/teacher/enrollments/:id/decision`  | Accept or decline           |
| `GET`  | `/teacher/classes`                   | Classes                     |
| `POST` | `/teacher/classes`                   | Create a class              |
| `POST` | `/teacher/classes/:id/past`          | Mark finished               |
| `GET`  | `/teacher/attendance`                | Sessions                    |
| `POST` | `/teacher/attendance`                | Record attendance           |
| `GET`  | `/teacher/assignments`               | Assignments                 |
| `POST` | `/teacher/assignments`               | Create one                  |
| `POST` | `/teacher/submissions/:id/grade`     | Grade                       |
| `GET`  | `/teacher/meetings`                  | Meetings                    |
| `POST` | `/teacher/meetings/:id/confirm`      | Confirm                     |
| `POST` | `/teacher/meetings/:id/request-slot` | Propose a slot              |

## 6. Backend

| File                        | What it does                               |
| --------------------------- | ------------------------------------------ |
| `routes/panels.ts`          | The teacher routes                         |
| `controllers/teacher.ts`    | The teacher panel data                     |
| `controllers/teaching.ts`   | Classes, assignments, attendance, meetings |
| `controllers/assessment.ts` | Grading                                    |
| `db/queries/`               | The SQL                                    |

## 7. Database

| Table                                        | What it holds                    |
| -------------------------------------------- | -------------------------------- |
| `users`                                      | The account (`role = 'teacher'`) |
| `teacher_courses`                            | Which courses they teach         |
| `classes`                                    | Their classes                    |
| `enrollments`                                | Their students                   |
| `assignments`                                | Work they set                    |
| `submissions`                                | Work their students submitted    |
| `attendance_sessions` / `attendance_records` | Attendance                       |
| `meetings`                                   | Parent meetings                  |

## 8. Permissions

| Action                     | Who                                |
| -------------------------- | ---------------------------------- |
| See their own students     | the teacher                        |
| Accept/decline a request   | the teacher it was sent to         |
| Create a class             | the teacher                        |
| Grade a submission         | the teacher who set the assignment |
| Assign a teacher's courses | an admin                           |
| Approve the account        | an admin                           |

> **A teacher only sees their own students.** The route checks the role; the
> controller checks that the enrollment belongs to this teacher.

## 9. Common Changes

### Change which courses a teacher can teach

An admin sets this on `/admin/users/detail` → `PATCH /admin/users/:id/courses`.
The data is `teacher_courses`.

### Change the enrollment decision rules

`controllers/teaching.ts` → `decideEnrollment`. Accepting can place the student
in an existing class or create a one-on-one enrollment.

### Add a field to an assignment

1. Add the column to `assignments` in `schema.ts`.
2. `db:generate` + `db:migrate`.
3. Return it from the teacher and student assignment queries.
4. Show it in both panels.

## 10. Troubleshooting

| Symptom                            | Cause                                     | Fix                                     |
| ---------------------------------- | ----------------------------------------- | --------------------------------------- |
| Teacher sees no students           | No accepted enrollments                   | Accept a request on `/teacher/requests` |
| "No courses" when creating a class | No `teacher_courses` rows                 | An admin must assign courses            |
| Cannot grade                       | The submission belongs to another teacher | Check the enrollment                    |
| Attendance will not save           | The session already exists for that date  | One session per class per day           |

## 11. Related Code

- `apps/web/app/teacher/`
- `apps/api/src/routes/panels.ts`
- `apps/api/src/controllers/teacher.ts`, `teaching.ts`, `assessment.ts`
- [Courses](./courses.md)
