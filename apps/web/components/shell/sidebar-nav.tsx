"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { navIcon } from "@/components/shell/nav-icons";
import {
  isNavItemActive,
  PANEL_LABEL,
  type NavBadgeKey,
  type NavGroup,
} from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

export interface SidebarNavProps {
  panel: "admin" | "student" | "teacher" | "parent";
  groups: NavGroup[];
  badges?: Partial<Record<NavBadgeKey, number>>;
  /** Mobile sheet: close after navigating. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The one sidebar used by every panel (the reference kit shipped four nearly
 * identical files). Server-rendered: the active item comes from `usePathname`
 * in a client leaf, so pages stay static and no path prop has to be threaded
 * through the layout.
 */
export function SidebarNav({
  panel,
  groups,
  badges = {},
  onNavigate,
  className,
}: SidebarNavProps) {
  const pathname = usePathname();
  const label = PANEL_LABEL[panel];

  return (
    <div
      className={cn(
        "quiet-scroll flex h-full flex-col gap-6 overflow-y-auto border-r border-border bg-secondary/60 px-4 py-5",
        className,
      )}
    >
      <Link
        href={`/${panel}`}
        onClick={onNavigate}
        className="flex items-center gap-3 px-2"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {label.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {label.subtitle}
          </span>
        </span>
      </Link>

      <nav className="flex-1" aria-label={`${label.subtitle} navigation`}>
        {groups.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);
                const Icon = navIcon(item.icon);
                const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-accent-foreground"
                            : "text-muted-foreground group-hover:text-primary",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {badge > 0 ? (
                        <span
                          className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
                          aria-label={`${badge} pending`}
                        >
                          {badge > 99 ? "99+" : badge}
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
    </div>
  );
}
