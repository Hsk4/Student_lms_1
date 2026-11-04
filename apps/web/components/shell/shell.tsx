"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth-compat";
import { BrandMark } from "@/components/brand/primitives";
import { RoleChip, StatusChip } from "@/components/ui/nila";
import { SCHOOL_NAME } from "@/lib/school";
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
 * Gate pages (request, pending, rejected, onboarding).
 *
 * Two bands, like the landing hero: a navy jaali strip carrying the BrandMark
 * and the panel name, then a white sheet pulled up over its bottom edge. The
 * visitor is still inside the product, not on a third-party widget skin.
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <BrandMark size={30} tone="light" />
              <span className="fastly-display text-[18px] text-white">
                {SCHOOL_NAME}
              </span>
            </Link>
            <span
              className="hidden h-5 w-px bg-on-navy-line sm:block"
              aria-hidden="true"
            />
            <span className="hidden truncate text-[13px] text-on-navy-soft sm:block">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {user ? <RoleChip role={user.role} /> : null}
            <UserButton />
          </div>
        </div>
      </header>

      {/* The sheet overlaps the band by 28px, the same device the phone screens use. */}
      <main className="relative -mt-7 flex-1">
        <div className="fastly-sheet mx-auto w-full max-w-3xl border-[1.5px] border-line bg-card px-5 py-8 sm:px-8">
          {children}
        </div>
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
