"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand/primitives";
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
import { cn } from "@/lib/utils";

export interface PanelShellProps {
  panel: "admin" | "student" | "teacher" | "parent";
  groups: NavGroup[];
  user: { name: string; email: string; role: string | null; status: string };
  badges?: Partial<Record<NavBadgeKey, number>>;
  /** Optional secondary badge under the avatar name (level, class …). */
  hint?: string;
  /**
   * Below `lg` students and parents get the five-item bottom tab bar from the
   * brand kit's App-Home screen. Admin and teacher keep the slide-over sheet
   * (their nav is long and grouped, which a five-tab bar would flatten).
   */
  mobile?: "sheet" | "bottom-tabs";
  children: React.ReactNode;
}

/**
 * One responsive frame for every panel: navy sidebar from `lg`, a navy topbar
 * whose subtitle follows the panel, and a mobile nav.
 *
 * The topbar and sidebar are the fixed brand navy, so their contents use the
 * `on-navy` tokens rather than `--foreground` and stay readable in dark mode.
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
  // Five is what fits a thumb-width tab without truncating labels.
  const bottomItems = flatItems.slice(0, 5);
  const hasBottomTabs = mobile === "bottom-tabs";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNav panel={panel} groups={groups} badges={badges} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="fastly-topbar sticky top-0 z-30">
          <div className="relative">
            <span
              className="fastly-jaali pointer-events-none absolute inset-0 opacity-70"
              aria-hidden="true"
            />
            <div className="relative flex h-16 items-center gap-3 px-4 sm:px-6">
              {hasBottomTabs ? (
                <Link
                  href={`/${panel}`}
                  className="flex items-center gap-2 lg:hidden"
                  aria-label={`${label.name} home`}
                >
                  <BrandMark size={28} tone="light" />
                </Link>
              ) : (
                <MobileNavSheet panel={panel} groups={groups} badges={badges} />
              )}

              {/*
               * The page body owns the <h1> (its PageHeader); this bar is a way
               * back and a breadcrumb. Rendering the route name here too printed
               * "Users / Users" on every page.
               */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {label.subtitle}
                </p>
                {current ? (
                  <p className="truncate text-xs text-on-navy-soft">{title}</p>
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

            {!hasBottomTabs ? (
              <nav
                aria-label="Sections"
                className="quiet-scroll relative flex gap-1 overflow-x-auto border-t-[1.5px] border-on-navy-line px-3 py-2 lg:hidden"
              >
                {flatItems.map((item) => {
                  const active = isNavItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-tint text-cobalt"
                          : "text-on-navy-soft hover:bg-white/8 hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </header>

        <main
          className={cn(
            "flex-1 px-4 py-6 sm:px-6 lg:px-8",
            hasBottomTabs ? "pb-28 lg:pb-10" : "",
          )}
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {hasBottomTabs ? (
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-30 border-t-[1.5px] border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="flex items-stretch px-2 pt-2">
            {bottomItems.map((item) => {
              const Icon = navIcon(item.icon);
              const active = isNavItemActive(pathname, item);
              return (
                <li key={item.href} className="flex flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("fastly-tab", active && "fastly-tab-active")}
                  >
                    <Icon
                      size={19}
                      strokeWidth={active ? 2.1 : 1.7}
                      aria-hidden="true"
                    />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="fastly-safe-gap" aria-hidden="true" />
        </nav>
      ) : null}
    </div>
  );
}
