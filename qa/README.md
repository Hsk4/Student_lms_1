# QA

Screenshots of every panel, captured from the running app. They are checked in
on purpose: a UI change is easier to review as "here is the before and after"
than as a description, and a reviewer can see what a route actually rendered
against real data.

## Layout

| Path                  | What it is                                                    |
| --------------------- | ------------------------------------------------------------- |
| `screenshots/`        | The captured PNGs, `NN-<route>.png` (desktop)                  |
| `screenshots.mjs`     | The harness that produces them                                 |
| `.tmp/`, `*.log`      | Scratch (browser profile, dev-server log) — git-ignored        |

## Capturing

```powershell
# Postgres must be up and migrated, and the dev server running on :3000
npm run dev

# every route listed in the script
node qa/screenshots.mjs

# one or more routes by name
node qa/screenshots.mjs 06-admin-users 18-student-dashboard

# the phone layout (390x844) writes <name>-m.png
$env:SHOT_MOBILE = "1"; node qa/screenshots.mjs 25-parent-dashboard

# the dark palette writes <name>-dark.png
$env:SHOT_THEME = "dark"; node qa/screenshots.mjs 04-admin-dashboard
```

## How sign-in works

The harness does not use a Clerk session. With `LMS_DEMO_ROLE` set, it writes a
`demo_<role>` `__session` cookie; `proxy.ts` short-circuits that cookie before
Clerk's middleware runs, and `lib/auth/demo.ts` resolves it to the seeded row in
`users` (see `scripts/seed-demo-users.ts`). One browser is therefore never signed
in as two roles at once, which is what makes four panels capturable in one run.

## Adding a route

Append `['NN-name', '/path', 'role']` to the `pages` array in `screenshots.mjs`.
The name is the file name; the role is `admin`, `teacher`, `student`, `parent`,
or `null` for the signed-out pages.
