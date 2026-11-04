import * as React from "react";
import { Inbox } from "lucide-react";

import { ArchTile } from "@/components/brand/primitives";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{
    className?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  /** One clear next action. Use at most one primary button. */
  action?: React.ReactNode;
  className?: string;
  /** `inline` for a smaller block inside a card. */
  size?: "default" | "inline";
}

/**
 * The brand empty state: a pointed arch holding a line icon, a short honest
 * sentence, and one next action.
 *
 * Copy rule: say what is missing and what will put something here. Never imply
 * data exists. Depth is the 1.5px border — no shadow, no dashed outline.
 */
export function EmptyState({
  title = "Nothing here yet",
  description = "Items appear here as soon as there is something to show.",
  icon: Icon = Inbox,
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "fastly-card flex flex-col items-center justify-center gap-3 bg-card px-6 text-center",
        size === "inline" ? "py-8" : "py-12",
        className,
      )}
    >
      <ArchTile size={size === "inline" ? 48 : 56} tone="tint">
        <Icon size={size === "inline" ? 20 : 24} strokeWidth={1.7} />
      </ArchTile>
      <div className="space-y-1">
        <h3 className="fastly-display text-[17px] text-ink">{title}</h3>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
