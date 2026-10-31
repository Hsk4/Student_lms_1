import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: React.ReactNode;
  /** Optional one-line context under the number. */
  hint?: string;
  /** Relative movement, e.g. `{ value: "+12%", direction: "up" }`. */
  delta?: { value: string; direction: "up" | "down" | "flat" };
}

/**
 * The row of summary tiles that sits under the page title in the reference kit
 * (its dashboard shows "Total students · Active courses · …").
 *
 * Kept a server component: the numbers come from `count()` queries, so there is
 * nothing to animate or fetch here. Pass real values — this renders whatever it
 * is given and invents no data.
 */
export function StatStrip({
  items,
  className,
}: {
  items: StatItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => {
        const Delta =
          item.delta?.direction === "down" ? ArrowDownRight : ArrowUpRight;
        const deltaTone =
          item.delta?.direction === "up"
            ? "text-status-green"
            : item.delta?.direction === "down"
              ? "text-status-red"
              : "text-muted-foreground";

        return (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <dt className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {item.value}
              </span>
              {item.delta ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    deltaTone,
                  )}
                >
                  {item.delta.direction === "flat" ? (
                    <Minus className="h-3 w-3" />
                  ) : (
                    <Delta className="h-3 w-3" />
                  )}
                  {item.delta.value}
                </span>
              ) : null}
            </dd>
            {item.hint ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {item.hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
