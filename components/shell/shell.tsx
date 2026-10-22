import Link from 'next/link';
import type { ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { RoleChip, StatusChip } from '@/components/ui/nila';

export type SidebarItem = { href: string; label: string; badge?: number };
export type SidebarGroup = { title: string; items: SidebarItem[] };

function Sidebar({ groups }: { groups: SidebarGroup[] }) {
  return (
    <aside className="w-60 shrink-0 bg-navy text-navy-foreground">
      <div className="flex h-16 items-center px-5 text-lg font-semibold tracking-tight">
        Fastly LMS
      </div>
      <nav className="space-y-5 px-3 pb-8">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest opacity-60">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-[var(--radius-card)] px-2 py-2 text-sm opacity-90 transition-colors duration-150 hover:bg-background hover:text-navy"
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-firoza px-2 text-xs font-semibold text-navy-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** The signed-in panel: navy sidebar, header with role and status chips. */
export function Shell({
  groups,
  user,
  children,
}: {
  groups: SidebarGroup[];
  user: { name: string; email: string; role: string | null; status: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar groups={groups} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <RoleChip role={user.role} />
            <StatusChip status={user.status} />
            <UserButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

/** Gate pages (request, pending, rejected, onboarding): one centred column, no sidebar. */
export function PanelShell({
  title,
  user,
  children,
}: {
  title: string;
  user?: { name: string; role: string | null };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
            Fastly LMS
          </Link>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? <RoleChip role={user.role} /> : null}
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">{children}</main>
    </div>
  );
}
const STUDENT_LINKS: SidebarGroup[] = [
  {
    title: 'Learning',
    items: [
      { href: '/student', label: 'Dashboard' },
      { href: '/student/courses', label: 'My courses' },
      { href: '/student/teachers', label: 'Teachers' },
      { href: '/student/assignments', label: 'Assignments' },
      { href: '/student/attendance', label: 'Attendance' },
      { href: '/student/materials', label: 'Materials' },
      { href: '/student/quizzes', label: 'Quizzes' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/student/invoices', label: 'Invoices' },
      { href: '/student/books', label: 'Books' },
      { href: '/student/guardians', label: 'Parent access' },
      { href: '/student/support', label: 'Support' },
    ],
  },
];

const TEACHER_LINKS: SidebarGroup[] = [
  {
    title: 'Teaching',
    items: [
      { href: '/teacher', label: 'Dashboard' },
      { href: '/teacher/requests', label: 'Requests' },
      { href: '/teacher/students', label: 'Students' },
      { href: '/teacher/classes', label: 'Classes' },
      { href: '/teacher/assignments', label: 'Assignments' },
      { href: '/teacher/attendance', label: 'Attendance' },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { href: '/teacher/meetings', label: 'Meetings' },
      { href: '/teacher/support', label: 'Support' },
    ],
  },
];

const PARENT_LINKS: SidebarGroup[] = [
  {
    title: 'Family',
    items: [
      { href: '/parent', label: 'Children' },
      { href: '/parent/link', label: 'Link a child' },
      { href: '/parent/invoices', label: 'Invoices' },
      { href: '/parent/meetings', label: 'Meetings' },
    ],
  },
];

/** A pill row: one tab per child, plus the option to show all children. */
export function ChildSwitcher({
  childRows,
  activeId,
  basePath,
}: {
  childRows: { id: string; name: string }[];
  activeId?: string;
  basePath: string;
}) {
  if (childRows.length < 2) return null;
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Choose a child">
      <Link
        href={basePath}
        className={`tab border border-border ${
          !activeId ? 'tab-active border-primary' : ''
        }`}
      >
        All children
      </Link>
      {childRows.map((child) => (
        <Link
          key={child.id}
          href={`${basePath}?child=${child.id}`}
          className={`tab border border-border ${
            child.id === activeId ? 'tab-active border-primary' : ''
          }`}
        >
          {child.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The signed-in panel shell. Server-rendered: the active sidebar item is
 * resolved on the server from the current path, so no client hooks are needed.
 */
export function Panel({
  panel,
  user,
  activeHref,
  children,
}: {
  panel: 'student' | 'teacher' | 'parent';
  user: { name: string; email: string; role: string | null; status: string };
  activeHref?: string;
  children: ReactNode;
}) {
  const groups =
    panel === 'student'
      ? STUDENT_LINKS
      : panel === 'teacher'
        ? TEACHER_LINKS
        : PARENT_LINKS;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 bg-navy text-navy-foreground md:block">
        <div className="flex h-16 items-center px-5 text-lg font-semibold tracking-tight">
          Fastly LMS
        </div>
        <nav className="space-y-5 px-3 pb-8">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest opacity-60">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-[var(--radius-card)] px-2 py-2 text-sm transition-colors duration-150 ${
                          active ? 'bg-background text-navy' : 'opacity-90 hover:bg-background hover:text-navy'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-firoza px-2 text-xs font-semibold text-navy-foreground">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/${panel}`} className="text-base font-semibold tracking-tight text-primary md:hidden">
              Fastly LMS
            </Link>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleChip role={user.role} />
            <StatusChip status={user.status} />
            <UserButton />
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
          {groups.flatMap((group) => group.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`tab shrink-0 ${item.href === activeHref ? 'tab-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
