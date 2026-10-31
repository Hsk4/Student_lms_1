import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Table-shaped placeholder. Used as the `loading.tsx` of list routes, so a
 * navigation to a slow query shows the table's own silhouette instead of a
 * centred spinner that then jumps into a table.
 */
export function LoadingSkeleton({
  rows = 8,
  columns = 5,
  className,
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-4 border-b border-border bg-secondary/60 px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`head-${index}`} className="h-3 w-24" />
        ))}
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex items-center gap-4 px-4 py-3.5"
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${columnIndex}`}
                className={cn("h-4", columnIndex === 0 ? "w-40" : "w-24")}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
