import * as React from "react";

import { cn } from "@/lib/utils";

interface ThemeSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A titled block of content, used by the reference kit's profile/settings
 * screens. Kept server-safe (no hooks) so pages can render it directly.
 */
export function ThemeSection({
  title,
  description,
  children,
  className,
}: ThemeSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      {title ? (
        <div className="mb-4 space-y-1 border-b border-border pb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
