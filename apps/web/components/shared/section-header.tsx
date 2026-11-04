import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * A dashboard section title: Fraunces, one size, optional cobalt "view all".
 *
 * Dashboards had six hand-written variants of this heading (uppercase grey,
 * `text-sm`, `text-lg`…). One component keeps every panel's rhythm identical.
 */
export function SectionHeader({
  title,
  action,
  description,
  className = "",
}: {
  title: string;
  /** `{ href, label }` renders a "View all" link; any node renders as-is. */
  action?: { href: string; label?: string } | ReactNode;
  description?: string;
  className?: string;
}) {
  const isLink =
    action !== null &&
    typeof action === "object" &&
    !Array.isArray(action) &&
    "href" in (action as Record<string, unknown>);

  return (
    <div
      className={`mb-3 flex flex-wrap items-baseline justify-between gap-2 ${className}`}
    >
      <div>
        <h2 className="fastly-display text-[19px] text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action === undefined ? null : isLink ? (
        <Link
          href={(action as { href: string }).href}
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-cobalt hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {(action as { label?: string }).label ?? "View all"}
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      ) : (
        <div className="flex items-center gap-2">{action as ReactNode}</div>
      )}
    </div>
  );
}
