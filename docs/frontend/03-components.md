# Components

**Purpose:** know which component to reach for, where it lives, and when to
write a new one instead of reusing an existing one.

Components live in `apps/web/components/`, in four groups.

---

## 1. The four groups

| Folder    | What it is                                       | Change it when…                            |
| --------- | ------------------------------------------------ | ------------------------------------------ |
| `ui/`     | The design system — the smallest reusable pieces | The _look_ of a control changes everywhere |
| `shared/` | Composed pieces used by many pages               | A pattern repeats across pages             |
| `shell/`  | The app frame — sidebar, topbar, nav             | The frame itself changes                   |
| `brand/`  | Logo, illustrations, landing sections            | The brand changes                          |

> **The rule:** if two pages need the same thing, it belongs in `shared/`. If it
> is a primitive with no domain knowledge, it belongs in `ui/`.

---

## 2. `ui/` — the design system

| Component           | What it is                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `button.tsx`        | `Button` with variants (`default`, `outline`, `ghost`, `destructive`) and sizes                                     |
| `input.tsx`         | Text input                                                                                                          |
| `table.tsx`         | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`                                           |
| `badge.tsx`         | Small status pill                                                                                                   |
| `avatar.tsx`        | `Avatar`, `AvatarFallback`                                                                                          |
| `dropdown-menu.tsx` | Radix dropdown                                                                                                      |
| `popover.tsx`       | Radix popover                                                                                                       |
| `sheet.tsx`         | Slide-over panel                                                                                                    |
| `action-form.tsx`   | `ActionForm` and `ActionButton` — a form/button with pending and error handling                                     |
| `nila.tsx`          | The page furniture: `PageHeader`, `Card`, `Chip`, `Notice`, `Empty`, `Stat`, `RoleChip`, `StatusChip`, `formatDate` |

### `ActionForm` and `ActionButton`

These are the standard way to submit something. They handle the pending state
and the error line, so a page does not repeat it:

```tsx
<ActionForm
  submitLabel="Create board"
  action={async (form) => {
    await api.post("/admin/boards", { name: form.get("name") });
    onDone?.();
    return null;
  }}
>
  <input name="name" className="input" />
</ActionForm>
```

`ActionButton` is the same for a one-off action:

```tsx
<ActionButton
  action={() => api.post(`/admin/users/${id}/suspend`)}
  confirm="Suspend this account?"
>
  Suspend
</ActionButton>
```

> **Why these exist:** every panel form needs the same three things — disable
> while sending, show the error, reset on success. Writing that per form is how
> they drift apart.

---

## 3. `shared/` — composed pieces

| Component                  | What it is                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `data-table-view.tsx`      | The list-page frame: toolbar, table card, empty state, **loading skeleton**, footer |
| `empty-state.tsx`          | "Nothing here yet" with an icon and optional action                                 |
| `error-state.tsx`          | A failed load, with a retry                                                         |
| `list-toolbar.tsx`         | Search + filter controls that write to the URL                                      |
| `pagination.tsx`           | Page controls that keep the current filters                                         |
| `stat-strip.tsx`           | The row of numbers at the top of a list page                                        |
| `section-header.tsx`       | A heading with an optional action                                                   |
| `skeleton.tsx`             | `InlineLoading`, `PanelSkeleton`                                                    |
| `notifications-drawer.tsx` | The bell in the topbar                                                              |

### `DataTableView` and the loading state

```tsx
<DataTableView
  loading={usersQuery.loading && users.length === 0}
  empty={users.length === 0}
  emptyTitle="No users match"
  toolbar={<ListToolbar … />}
  footer={<Pagination … />}
>
  <Table>…</Table>
</DataTableView>
```

> **Why `loading` exists:** pages used to pass only `empty={rows.length === 0}`,
> which is true _while loading_, so a list showed "No users match" for a second
> before the rows arrived. That reads as "your data is gone".

---

## 4. `shell/` — the app frame

| File                   | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `panel-shell.tsx`      | The panel frame: sidebar, topbar, mobile nav, bottom tabs       |
| `shell.tsx`            | `Shell` (simple header) and `GateShell` (the navy band + sheet) |
| `sidebar-nav.tsx`      | The navy sidebar                                                |
| `mobile-nav-sheet.tsx` | The hamburger menu on a phone                                   |
| `nav-config.ts`        | **The nav entries** — add a page here                           |
| `nav-icons.ts`         | Maps an icon name to a Lucide icon                              |
| `page-actions.tsx`     | The topbar's right cluster: theme, account                      |
| `user-menu.tsx`        | The avatar dropdown, including sign-out                         |
| `theme-picker.tsx`     | Light/dark/system                                               |

### Adding a nav entry

`nav-config.ts`:

```ts
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: "People",
    items: [
      {
        href: "/admin/requests",
        label: "Requests",
        icon: "Inbox",
        badgeKey: "pending",
      },
      { href: "/admin/users", label: "Users", icon: "Users" },
    ],
  },
];
```

`icon` is a `NavIconName` — a capitalised Lucide name (`"Inbox"`, `"Users"`),
resolved by `nav-icons.ts`. `badgeKey` shows a count from `/me`'s
`pendingRequests`; the allowed keys are `pending`, `requests`, `grading` and
`meetings`.

---

## 5. `brand/`

| File                   | What it is                                |
| ---------------------- | ----------------------------------------- |
| `primitives.tsx`       | `BrandMark`, `ArchTile`, `ArchNumber`     |
| `illustrations.tsx`    | The drawn illustrations (hourglass, etc.) |
| `landing-sections.tsx` | The landing page sections                 |
| `suspended-notice.tsx` | The `?error=` banner (a client island)    |

---

## 6. Server vs client components

| Component                                | Kind       | Why                                 |
| ---------------------------------------- | ---------- | ----------------------------------- |
| `landing-sections.tsx`                   | **Server** | It is the page search engines index |
| `suspended-notice.tsx`                   | Client     | Reads `useSearchParams`             |
| `native-welcome.tsx`                     | Client     | Reads `window.Capacitor`            |
| Everything in `ui/`, `shared/`, `shell/` | Client     | They use state, effects or events   |

> **Do not add `"use client"` to `landing-sections.tsx`.** It would turn the
> landing page back into an empty shell for crawlers. Put the interactive part
> in its own small component instead.

---

## 7. Styling

Tailwind CSS v4, with the design tokens in `app/globals.css`.

| Convention                  | Example                                              |
| --------------------------- | ---------------------------------------------------- |
| Colours come from tokens    | `text-foreground`, `bg-card`, `border-border`        |
| Brand classes for the frame | `fastly-sidebar`, `fastly-gate-band`, `fastly-sheet` |
| `cn()` merges classes       | `cn("base", condition && "extra")`                   |

> **Never hardcode a hex colour.** `bun run lint:colors` fails the build on one.
> The tokens are what make dark mode work.

---

## 8. Writing a new component

1. Is it a primitive with no domain knowledge? → `ui/`.
2. Is it used by more than one page? → `shared/`.
3. Is it specific to one page? → keep it next to that page (`app/<path>/<name>.tsx`).

```tsx
// components/shared/stat-strip.tsx
export function StatStrip({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-2xl font-semibold">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
```

---

## 9. Related

- [Web Overview](./01-web-overview.md)
- [Pages](./02-pages.md)
- [Rendering and Builds](./05-rendering-and-builds.md)

---

## Files this document was based on

- `apps/web/components/ui/`, `shared/`, `shell/`, `brand/`
- `apps/web/components/ui/action-form.tsx`
- `apps/web/components/shared/data-table-view.tsx`
- `apps/web/components/shell/nav-config.ts`
- `apps/web/app/globals.css`
