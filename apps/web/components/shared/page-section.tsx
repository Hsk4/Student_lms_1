import * as React from "react";

import { cn } from "@/lib/utils";

interface PageSectionProps {
  /** Main column content (usually the list). */
  children: React.ReactNode;
  /** Right-hand rail (create/edit form). Sits beside the list on `lg`. */
  aside?: React.ReactNode;
  /** Rail width. Forms read better at 340px; detail panes at 380px. */
  asideWidth?: "sm" | "md";
  /** Headline above the whole section, e.g. "All users". */
  title?: string;
  description?: string;
  /** Right-aligned actions in the section header. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The list + form split used by the reference kit's catalogue screens: the
 * table gets the flexible column, the create/edit form a fixed rail that sticks
 * while the list scrolls.
 *
 * `lg:sticky` is why the rail is a single child: the sidebar offset (4rem
 * header) is subtracted so the form never hides under the sticky topbar.
 */
export function PageSection({
  children,
  aside,
  asideWidth = "sm",
  title,
  description,
  actions,
  className,
}: PageSectionProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      {aside ? (
        <div
          className={cn(
            "grid items-start gap-6",
            asideWidth === "md"
              ? "lg:grid-cols-[minmax(0,1fr)_380px]"
              : "lg:grid-cols-[minmax(0,1fr)_340px]",
          )}
        >
          <div className="min-w-0">{children}</div>
          <div className="lg:sticky lg:top-[calc(4rem+1.5rem)]">{aside}</div>
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </section>
  );
}
