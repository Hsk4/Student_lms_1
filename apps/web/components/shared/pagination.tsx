import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize?: number;
  /** Current query string, so page links keep the active filters. */
  searchParams?: Record<string, string | undefined>;
  /** Where the page links point, e.g. "/admin/users". */
  basePath: string;
  pageParam?: string;
  className?: string;
}

/**
 * Reference kit `Pagination`, rebuilt on URLs.
 *
 * Its original `onPageChange(page)` needs client state; these pages are server
 * components reading the database. Making each page number a real `<a>` keeps
 * pagination working without JavaScript, keeps the back button honest, and
 * makes a filtered+paginated view a shareable link. `searchParams` is threaded
 * back in so paging never drops the active search or status filter.
 */
export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize = 20,
  searchParams = {},
  basePath,
  pageParam = "page",
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set(pageParam, String(target));
    else params.delete(pageParam);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  // A window of at most five pages that always contains the current one.
  const windowSize = Math.min(5, pageCount);
  const start = Math.min(
    Math.max(1, page - Math.floor(windowSize / 2)),
    pageCount - windowSize + 1,
  );
  const pages = Array.from({ length: windowSize }, (_, i) => start + i);

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span>
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        {page <= 1 ? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Previous page"
          >
            <a href={href(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </a>
          </Button>
        )}

        {pages.map((pageNumber) => (
          <Button
            key={pageNumber}
            asChild
            size="icon"
            variant={pageNumber === page ? "default" : "ghost"}
            className="h-9 w-9"
          >
            <a
              href={href(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
            >
              {pageNumber}
            </a>
          </Button>
        ))}

        {page >= pageCount ? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Next page"
          >
            <a href={href(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </a>
          </Button>
        )}
      </nav>
    </div>
  );
}
