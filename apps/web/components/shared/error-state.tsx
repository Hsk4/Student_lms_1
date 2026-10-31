import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /**
   * A server-rendered retry is a link, not a callback: this component has no
   * "request failed and re-fetch" cycle to drive, because the page either
   * rendered or threw. Pass an href that re-runs the query.
   */
  retryHref?: string;
  /** Client-side callers (forms, tables with local state) may pass a handler. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Reference kit `ErrorState`, on the Nila status tokens instead of red-50/red-950
 * so it matches `Notice` and the destructive button in both themes.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this list right now. Please try again in a moment.",
  retryHref,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-status-red bg-status-red-soft px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-status-red">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {retryHref ? (
        <Button asChild variant="outline">
          <a href={retryHref}>
            <RotateCcw />
            Try again
          </a>
        </Button>
      ) : onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCcw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
