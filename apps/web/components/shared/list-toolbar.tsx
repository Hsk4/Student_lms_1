import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  /** Query-string key, e.g. "status". */
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
}

interface ListToolbarProps {
  /** Where the form submits; usually the current pathname. */
  action: string;
  searchParam?: string;
  searchPlaceholder?: string;
  searchValue: string;
  filters?: FilterConfig[];
  /** True when any filter/search is set, so "Clear" is worth showing. */
  className?: string;
  /** Buttons that belong beside the filters (e.g. "Add user"). */
  children?: React.ReactNode;
}

/**
 * Reference kit `ListToolbar` as a GET form.
 *
 * The reference filtered client-side, so a `Select` could call `onChange`
 * directly. These lists are paged server-side from Postgres, so the controls
 * are plain form fields and the URL is the state: submitting re-renders the
 * server component with new rows, the back button works, and a filtered view
 * can be bookmarked or pasted into a ticket.
 *
 * `Clear` is a link back to `action`, not a JS reset, for the same reason.
 */
export function ListToolbar({
  action,
  searchParam = "q",
  searchPlaceholder = "Search...",
  searchValue,
  filters = [],
  children,
}: ListToolbarProps) {
  const hasActiveFilters =
    searchValue.trim().length > 0 || filters.some((filter) => filter.value);

  return (
    <form
      action={action}
      method="get"
      role="search"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      <div className="relative w-full md:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name={searchParam}
          defaultValue={searchValue}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label={searchPlaceholder}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <label key={filter.id} className="sr-only" htmlFor={`f-${filter.id}`}>
            {filter.label}
          </label>
        ))}
        {filters.map((filter) => (
          <select
            key={filter.id}
            id={`f-${filter.id}`}
            name={filter.id}
            defaultValue={filter.value}
            aria-label={filter.label}
            className="input w-[150px]"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        <Button type="submit" size="sm">
          Apply
        </Button>

        {hasActiveFilters ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <a href={action}>
              <X />
              Clear
            </a>
          </Button>
        ) : null}

        {children}
      </div>
    </form>
  );
}
