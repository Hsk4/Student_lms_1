# Parents and Guardian Links

## 1. What is it?

How a parent gets connected to their child, and what they can then see. The link
is made with a short code the student generates — no email is involved.

## 2. Who uses it?

Students (create the code), parents (redeem it), admins (repair links).

## 3. User Flow

```text
STUDENT                          PARENT
   │                                │
   │ /onboarding/parent             │
   │ "Create link code"             │
   ▼                                │
 code: NCYJUPWF                     │
   │                                │
   │  shares it out of band         │
   └───────────────────────────────▶│
                                    │ /sign-up/parent → account
                                    │ admin approves the parent role
                                    ▼
                              /parent/link → enter the code
                                    │
                                    ▼
                              linked → /parent
```

The student becomes `onboarded` at the moment the parent redeems the code.

## 4. Frontend

| File | What it shows |
| --- | --- |
| `app/onboarding/parent/page.tsx` | The student's guardian step |
| `app/onboarding/parent/parent-form.tsx` | Create the code |
| `app/parent/link/page.tsx` | The parent redeems a code |
| `app/parent/link/link-form.tsx` | The redeem form |
| `app/parent/page.tsx` | Children overview |
| `app/parent/children/page.tsx` | The children list |
| `app/parent/children/detail/page.tsx` | One child |
| `app/parent/invoices/page.tsx` | Fees |
| `app/parent/meetings/page.tsx` | Meetings |
| `app/parent/parent-forms.tsx` | Meeting forms |
| `app/student/guardians/page.tsx` | The student's side: see and revoke codes |
| `app/admin/parent-invites/page.tsx` | Admin repair tools |

## 5. API

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/student/parent-links` | student (onboarding) |
| `POST` | `/student/parent-links/:id/revoke` | student |
| `GET` | `/student/guardians` | student |
| `POST` | `/parent/parent-links/redeem` | parent |
| `GET` | `/parent/overview` | parent |
| `GET` | `/parent/children/:id` | parent |
| `GET` | `/parent/meetings` | parent |
| `POST` | `/parent/meetings` | parent |
| `GET` | `/admin/parent-links` | admin |
| `POST` | `/admin/guardians` | admin |
| `DELETE` | `/admin/guardians` | admin |

## 6. Backend

| File | What it does |
| --- | --- |
| `routes/parent.ts` | The link routes |
| `controllers/parent.ts` | Create, revoke, redeem |
| `controllers/parent-panel.ts` | The parent panel data |
| `lib/link-codes.ts` | Code generation |
| `db/queries/guardianships.ts` | The link table |

### The code

- 8 characters, uppercase, from a 23-character alphabet that drops every
  lookalike: `0/O`, `1/I/L`, `5/S`, `8/B`, `2/Z`.
- Input is normalised, so `abcd-efgh`, ` abcd efgh ` and lowercase all work.
- Valid for **14 days**, single use.
- `attempts` is incremented **in SQL**, never read-then-write, so guessing is
  rate-limited even under concurrency.

### Redeeming

```ts
const claimed = await tx
  .update(parentInvites)
  .set({ state: "accepted", acceptedBy: actor.id, acceptedAt: new Date() })
  .where(and(eq(parentInvites.id, invite.id), eq(parentInvites.state, "sent")))
  .returning({ id: parentInvites.id });

if (claimed.length === 0) throw conflict("This code has already been used.");

await linkParentToStudent(actor.id, invite.studentId, { markOnboarded: true }, tx);
```

The conditional `UPDATE` is what makes a code single-use: two parents redeeming
at the same moment, and only one wins.

## 7. Database

| Table | What it holds |
| --- | --- |
| `parent_invites` | The codes: student, code, state, expiry, attempts |
| `guardianships` | The links: `(student_id, parent_id)` composite key |
| `users` | `onboarded` flips to true on the student |

A CHECK prevents a user being their own guardian.

## 8. Permissions

| Action | Who |
| --- | --- |
| Create a code | the student |
| Revoke a code | the student who created it |
| Redeem a code | a parent |
| See a child's data | a linked parent only |
| Repair a link | admin |

## 9. Common Changes

### Change the code length or alphabet

`apps/api/src/lib/link-codes.ts`. The database CHECK requires uppercase.

### Change the expiry

`LINK_CODE_TTL_DAYS` in `controllers/parent.ts`.

### Change the maximum number of guardians

`controllers/parent.ts` → `if (alreadyLinked.length >= 5)`.

### Let a parent link without approval

Not currently possible: the parent needs the `parent` role first, which an admin
grants. Changing that means changing `homeFor()` and the redeem route's guard.

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "That code did not work" | Wrong code, expired, or already used | Issue a new one |
| "That email already has an account" | The parent signed up already | They redeem from their own panel instead |
| Student still on `/onboarding/parent` | The code was never redeemed | The parent must redeem it |
| `403` creating a code | The route lost `allowRestricted` | Restore it |
| Parent sees no children | The link was never made | Check `guardianships` in `db:studio` |
| "You already have the maximum number of guardians" | 5 links exist | Revoke one |

## 11. Related Code

- `apps/web/app/onboarding/parent/`, `app/parent/`, `app/student/guardians/`
- `apps/api/src/routes/parent.ts`
- `apps/api/src/controllers/parent.ts`, `parent-panel.ts`
- `apps/api/src/lib/link-codes.ts`
- [Students](./students.md)
