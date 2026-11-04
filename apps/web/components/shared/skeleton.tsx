/**
 * Loading placeholders.
 *
 * A bare "Loading..." line made every page flash an empty box and then jump
 * when the data arrived. A skeleton of the shape that is about to land (a
 * header, the stat strip, a list) keeps the layout still, so the page settles
 * instead of reflowing.
 *
 * No shimmer animation: the brand has no gradients, and a quiet pulse reads
 * calmer on a school dashboard that people leave open all day.
 */

"use client";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-secondary ${className}`}
      aria-hidden="true"
    />
  );
}

/** The signed-in panel's first paint. */
export function PanelSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fastly-card space-y-2.5 bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="fastly-card bg-card p-4">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A table-shaped placeholder, for the admin list pages. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="fastly-card overflow-hidden bg-card" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="border-b-[1.5px] border-line bg-secondary/60 px-4 py-3">
        <Skeleton className="h-3.5 w-36" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b-[1.5px] border-line px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A single-line placeholder, for inline waits that are not a full page. */
export function InlineLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-sm text-muted-foreground">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-cobalt"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}
