"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth-compat";
import { RoleChip, StatusChip } from "@/components/ui/nila";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_SUPER_NAV,
  PARENT_NAV_GROUPS,
  STUDENT_NAV_GROUPS,
  TEACHER_NAV_GROUPS,
} from "@/components/shell/nav-config";

/**
 * Shells.
 *
 * `PanelShell` (the signed-in frame with sidebar/header/mobile nav) lives in
 * `components/shell/panel-shell.tsx`; it is a client component because the
 * active nav item comes from `usePathname`. This file holds the server-safe
 * shells that gate pages use, plus the app's own navigation arrays re-exported
 * under their old names so page code keeps working.
 */

type PanelUser = {
  name: string;
  email: string;
  role: string | null;
  status: string;
};

/** The signed-in panel: header with role and status chips plus Clerk's avatar. */
export function Shell({
  user,
  children,
}: {
  user: PanelUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name}
          </p>
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
  );
}

/**
 * Gate pages (request, pending, rejected, onboarding): one centred column, no
 * sidebar. The reference kit's `PageHeader` markup, applied to the public
 * signed-out surface.
 */
export function GateShell({
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
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-primary"
          >
            Fastly LMS
          </Link>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? <RoleChip role={user.role} /> : null}
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {children}
      </main>
    </div>
  );
}

/** Kept for the pages that still import the old name. */
export const PanelShell = GateShell;

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
    <nav
      className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-lg bg-secondary p-1"
      aria-label="Choose a child"
    >
      <Link href={basePath} className={`tab ${!activeId ? "tab-active" : ""}`}>
        All children
      </Link>
      {childRows.map((child) => (
        <Link
          key={child.id}
          href={`${basePath}?child=${child.id}`}
          className={`tab ${child.id === activeId ? "tab-active" : ""}`}
        >
          {child.name}
        </Link>
      ))}
    </nav>
  );
}

export const STUDENT_LINKS = STUDENT_NAV_GROUPS;
export const TEACHER_LINKS = TEACHER_NAV_GROUPS;
export const PARENT_LINKS = PARENT_NAV_GROUPS;
export const ADMIN_LINKS = ADMIN_NAV_GROUPS;
export { ADMIN_SUPER_NAV };
