# Courses and the Catalogue

## 1. What is it?

The school's catalogue: exam boards, levels, subjects, and the **courses** that
combine them. Everything else — classes, enrollments, books, materials — hangs
off a course.

## 2. Who uses it?

| Who      | What they do                                                        |
| -------- | ------------------------------------------------------------------- |
| Admins   | Create and edit boards, levels, subjects, courses, books, materials |
| Students | Pick a board and level, then request a teacher for a course         |
| Teachers | Teach courses assigned to them                                      |
| Parents  | See their child's courses                                           |

## 3. User Flow

### An admin builds the catalogue

```text
/admin/boards   → add "Sindh Board (BISE Karachi)"
/admin/courses  → add levels and subjects, then combine them into courses
/admin/books    → add books and attach them to courses
/admin/materials → add links to course materials
```

### A student uses it

```text
/request → choose board + level + subjects
/student/teachers → see teachers for courses matching that board and level
```

## 4. Frontend

| File                                | What it shows                            |
| ----------------------------------- | ---------------------------------------- |
| `app/admin/boards/page.tsx`         | Boards                                   |
| `app/admin/boards/board-ui.tsx`     | The board forms                          |
| `app/admin/courses/page.tsx`        | Courses, levels, subjects                |
| `app/admin/courses/course-ui.tsx`   | Course forms                             |
| `app/admin/courses/level-ui.tsx`    | Level forms                              |
| `app/admin/courses/subject-ui.tsx`  | Subject forms                            |
| `app/admin/courses/detail/page.tsx` | One course                               |
| `app/admin/books/page.tsx`          | Books                                    |
| `app/admin/books/book-ui.tsx`       | Book forms                               |
| `app/admin/materials/page.tsx`      | Materials                                |
| `app/request/request-form.tsx`      | The student's board/level/subject picker |

## 5. API

| Method  | Path                                                 | Who                                   |
| ------- | ---------------------------------------------------- | ------------------------------------- |
| `GET`   | `/catalog/form-options`                              | any signed-in account (incl. pending) |
| `GET`   | `/admin/catalog`                                     | admin                                 |
| `GET`   | `/admin/courses`                                     | admin                                 |
| `GET`   | `/admin/courses/:id`                                 | admin                                 |
| `POST`  | `/admin/boards`                                      | admin                                 |
| `POST`  | `/admin/levels`                                      | admin                                 |
| `POST`  | `/admin/subjects`                                    | admin                                 |
| `POST`  | `/admin/courses`                                     | admin                                 |
| `PATCH` | `/admin/{boards,levels,subjects,courses}/:id`        | admin                                 |
| `PATCH` | `/admin/{boards,levels,subjects,courses}/:id/active` | admin                                 |
| `POST`  | `/admin/books`                                       | admin                                 |
| `POST`  | `/admin/materials`                                   | admin                                 |

> `/catalog/form-options` uses `allowRestricted` because the request form is
> filled in by accounts that are not active yet.

## 6. Backend

| File                                                                         | What it does                 |
| ---------------------------------------------------------------------------- | ---------------------------- |
| `routes/catalog.ts`                                                          | The catalogue routes         |
| `controllers/catalog.ts`                                                     | Create, update, toggle, list |
| `db/queries/boards.ts`, `levels.ts`, `subjects.ts`, `courses.ts`, `books.ts` | The SQL                      |
| `scripts/seed-catalog.ts`                                                    | The starter catalogue        |
| `src/db/seed-catalog.sql`                                                    | The same, as plain SQL       |

## 7. Database

```text
boards ──┐
levels ──┼──▶ courses ──▶ book_courses ──▶ books
subjects ┘        │
                  ├──▶ materials
                  ├──▶ classes
                  └──▶ assignments
```

| Table       | What it holds                                       |
| ----------- | --------------------------------------------------- |
| `boards`    | Exam boards (FBISE, Sindh, Punjab, AKEB, Cambridge) |
| `levels`    | Grade levels, with an `order`                       |
| `subjects`  | Subjects                                            |
| `courses`   | One board + level + subject (+ optional medium)     |
| `books`     | Books, linked to courses through `book_courses`     |
| `materials` | A title, a type and a **URL** (no file upload)      |

A course is unique on `(board_id, level_id, subject_id, medium)`.

## 8. Permissions

| Action                | Who                                          |
| --------------------- | -------------------------------------------- |
| Read the catalogue    | any signed-in account                        |
| Read the form options | any signed-in account, **including pending** |
| Create or edit        | admin, super admin                           |
| Toggle active         | admin, super admin                           |

## 9. Common Changes

### Add a board

`/admin/boards` → "Create board". Or run the seed.

### Add a course

`/admin/courses` → pick a board, level and subject → "Create course".

### Deactivate instead of deleting

Every catalogue row has `active`. Toggling it hides the row from the form
options without breaking existing enrollments. **Prefer this to deleting.**

### Seed a fresh database

```bash
bun run --cwd apps/api seed:catalog
```

Adds 5 boards, 7 levels, 14 subjects and 214 courses. Idempotent.

### Change which subjects a level offers

`scripts/seed-catalog.ts` (and `seed-catalog.sql`) hold the combinations. Edit
both, or add the courses through the admin UI.

## 10. Troubleshooting

| Symptom                                    | Cause                                                         | Fix                                     |
| ------------------------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| "The catalog is empty" on the request form | `boards`/`levels`/`subjects` have no rows                     | Run `seed:catalog`                      |
| The form options return `403`              | The route lost `allowRestricted`                              | Restore it                              |
| A course will not save                     | That board+level+subject already exists                       | Edit the existing one                   |
| A student sees no teachers                 | No teacher is assigned to a course matching their board/level | Assign courses on `/admin/users/detail` |
| A deactivated board still appears          | The page cached the list                                      | Reload; the API filters on `active`     |

## 11. Related Code

- `apps/web/app/admin/boards/`, `courses/`, `books/`, `materials/`
- `apps/api/src/routes/catalog.ts`
- `apps/api/src/controllers/catalog.ts`
- `apps/api/src/db/schema.ts` — the catalogue tables
- `apps/api/scripts/seed-catalog.ts`, `src/db/seed-catalog.sql`
