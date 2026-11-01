import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Reference kit `Badge`, with the status tones pointed at the Nila
 * `--status-*-soft` pairs so badges match `StatusChip` and `Chip` elsewhere on
 * the page. The reference's one-off sky/emerald/amber classes would have
 * introduced three more colours into the palette.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
        outline: "border-border text-foreground",
        success: "border-status-green bg-status-green-soft text-status-green",
        warning: "border-status-amber bg-status-amber-soft text-status-amber",
        destructive: "border-status-red bg-status-red-soft text-status-red",
        info: "border-border bg-tint text-tint-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
