import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface DataTableViewProps {
  /** Rendered above the table, outside the border (search + filters). */
  toolbar?: React.ReactNode;
  /** Rendered under the table (pagination, totals). */
  footer?: React.ReactNode;
  empty?: boolean;
  /**
   * The first load is still in flight. Without this a page that passes
   * `empty={rows.length === 0}` shows "nothing here" for a second before the
   * rows arrive, which reads as "your data is gone".
   */
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyAction?: React.ReactNode;
  className?: string;
  /** The `<Table>` itself. */
  children?: React.ReactNode;
}

/**
 * The list-page layout from the reference kit: toolbar, bordered table card,
 * empty state, pagination — stacked with one gap so each surface reads as its
 * own layer.
 *
 * Why not the reference's generic `columns`/`rows`/`loading`/`error` component:
 * those pages fetched client-side, so the table had to own loading and failure
 * itself. A server component has already resolved both by the time it renders —
 * a thrown query becomes the route's `error.tsx`, a slow one becomes
 * `loading.tsx`. Reproducing that state machine here would mean shipping client
 * state for states that can never occur, so the page keeps writing real
 * `<Table>` markup (cell content varies too much per domain) and this supplies
 * the frame. Pages that genuinely load late can drop `<LoadingSkeleton>` or
 * `<ErrorState>` in as children.
 */
export function DataTableView({
  toolbar,
  footer,
  empty = false,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
  children,
}: DataTableViewProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {toolbar}
      {loading ? (
        <div
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-9 animate-pulse rounded-md bg-muted"
                style={{ opacity: 1 - row * 0.18 }}
              />
            ))}
          </div>
          <span className="sr-only">Loading</span>
        </div>
      ) : empty ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {children}
        </div>
      )}
      {footer}
    </div>
  );
}
