"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand/primitives";
import { navIcon } from "@/components/shell/nav-icons";
import {
  isNavItemActive,
  PANEL_LABEL,
  type NavBadgeKey,
  type NavGroup,
} from "@/components/shell/nav-config";
import { SCHOOL_NAME } from "@/lib/school";
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
 * The one sidebar used by every panel.
 *
 * Navy with the jaali lattice behind it, the BrandMark in place of a generic
 * icon, and the active item on the pale-blue tint with cobalt type — the
 * signed-in counterpart of the landing hero. The navy is the fixed brand
 * colour, so this panel reads the same in light and dark mode; type inside it
 * uses `--fastly-on-navy-*`, never `--foreground`.
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
        "fastly-sidebar quiet-scroll relative flex h-full flex-col overflow-y-auto",
        className,
      )}
    >
      <span
        className="fastly-jaali pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div className="relative flex min-h-full flex-col px-3 py-5">
        <Link
          href={`/${panel}`}
          onClick={onNavigate}
          className="mb-6 flex items-center gap-3 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <BrandMark size={36} tone="light" />
          <span className="min-w-0">
            <span className="fastly-display block truncate text-[17px] leading-tight text-white">
              {label.name}
            </span>
            <span className="block truncate text-[11px] text-on-navy-soft">
              {label.subtitle}
            </span>
          </span>
        </Link>

        <nav className="flex-1" aria-label={`${label.subtitle} navigation`}>
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p className="fastly-nav-group px-3 pb-2">{group.title}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item);
                  const Icon = navIcon(item.icon);
                  const badge = item.badgeKey
                    ? (badges[item.badgeKey] ?? 0)
                    : 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "fastly-nav-item",
                          isActive && "fastly-nav-item-active",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-cobalt" : "text-white/70",
                          )}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {badge > 0 ? (
                          <span
                            className="fastly-nav-badge"
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

        <p className="mt-6 border-t-[1.5px] border-on-navy-line px-3 pt-4 text-[11px] leading-relaxed text-white/56">
          {SCHOOL_NAME}
        </p>
      </div>
    </div>
  );
}
