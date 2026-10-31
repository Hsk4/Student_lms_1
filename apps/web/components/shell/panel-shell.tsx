"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navIcon } from "@/components/shell/nav-icons";
import {
  findNavItem,
  isNavItemActive,
  PANEL_LABEL,
  type NavBadgeKey,
  type NavGroup,
} from "@/components/shell/nav-config";
import { MobileNavSheet } from "@/components/shell/mobile-nav-sheet";
import { PageActions } from "@/components/shell/page-actions";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationsDrawer } from "@/components/shared/notifications-drawer";

export interface PanelShellProps {
  panel: "admin" | "student" | "teacher" | "parent";
  groups: NavGroup[];
  user: { name: string; email: string; role: string | null; status: string };
  badges?: Partial<Record<NavBadgeKey, number>>;
  /** Optional secondary badge under the avatar name (level, class …). */
  hint?: string;
  /**
   * Below `lg` the parent panel shows a compact topbar and a bottom tab bar
   * instead of a sheet, matching the reference kit's mobile layout.
   */
  mobile?: "sheet" | "bottom-tabs";
  children: React.ReactNode;
}

/**
 * One responsive frame for every panel: sticky sidebar from `lg`, a sticky
 * header whose title follows the current route, and a mobile nav (sheet, or
 * bottom tabs for parents). The reference kit had four separate layouts; they
 * differed only in nav data and header extras, so they are one component here.
 */
export function PanelShell({
  panel,
  groups,
  user,
  badges,
  hint,
  mobile = "sheet",
  children,
}: PanelShellProps) {
  const pathname = usePathname();
  const current = findNavItem(pathname, groups);
  const label = PANEL_LABEL[panel];
  const title = current?.label ?? label.subtitle;
  const description = current?.description ?? "";

  const pendingBadge = badges?.pending ?? 0;
  const notifications =
    pendingBadge > 0
      ? [
          {
            id: "pending",
            title: `${pendingBadge} pending request${pendingBadge === 1 ? "" : "s"}`,
            body: "Open the requests queue to review them.",
            href: panel === "admin" ? "/admin/requests" : undefined,
          },
        ]
      : [];

  const flatItems = groups.flatMap((group) => group.items);
  const bottomItems = flatItems.slice(0, 5);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNav panel={panel} groups={groups} badges={badges} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            {mobile === "sheet" ? (
              <MobileNavSheet panel={panel} groups={groups} badges={badges} />
            ) : (
              <Link
                href={`/${panel}`}
                className="text-base font-semibold tracking-tight text-primary lg:hidden"
              >
                {label.name}
              </Link>
            )}

            {/*
             * The page body owns the <h1> (its PageHeader); this bar is a way
             * back and a breadcrumb. Rendering the route name here too printed
             * "Users / Users" on every page.
             */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {label.subtitle}
              </p>
              {description ? (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {title}
                </p>
              ) : null}
            </div>

            {notifications.length ? (
              <NotificationsDrawer items={notifications} />
            ) : null}

            <span className="hidden lg:block">
              <PageActions user={user} />
            </span>
            <span className="lg:hidden">
              <UserMenu name={user.name} email={user.email} hint={hint} />
            </span>
          </div>

          {mobile === "sheet" ? (
            <nav
              aria-label="Sections"
              className="quiet-scroll flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden"
            >
              {flatItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    isNavItemActive(pathname, item) ? "page" : undefined
                  }
                  className={`tab shrink-0 ${
                    isNavItemActive(pathname, item) ? "tab-active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        <main
          className={`flex-1 px-4 py-6 sm:px-6 lg:px-8 ${
            mobile === "bottom-tabs" ? "pb-24 lg:pb-10" : ""
          }`}
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {mobile === "bottom-tabs" ? (
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card/95 backdrop-blur lg:hidden"
          style={{ gridTemplateColumns: `repeat(${bottomItems.length}, 1fr)` }}
        >
          {bottomItems.map((item) => {
            const Icon = navIcon(item.icon);
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
