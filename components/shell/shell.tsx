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
