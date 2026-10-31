"use client";

import * as React from "react";
import { Check, Monitor, MonitorCog, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  prefersDark,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Full-width theme selector for the settings pages.
 *
 * Same storage key and same `dark` class as the header control
 * (`components/shell/page-actions.tsx`) — two places to set one preference, not
 * two preferences. The buttons are real radios, so the choice is keyboard
 * navigable and announced correctly.
 */
/** `true` once React has hydrated on the client — no state, no cascading render. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.some((option) => option.value === stored)
    ? (stored as ThemeChoice)
    : "system";
}

export function ThemePicker() {
  // Read during the first render: the boot script already applied the choice to
  // <html>, so the picker has to agree with what is on screen — and a `useState`
  // initialiser is the one place that can do so without a cascading render.
  const [theme, setTheme] = React.useState<ThemeChoice>(readStoredTheme);
  const mounted = useIsClient();

  const choose = (next: ThemeChoice) => {
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", prefersDark(next));
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="grid gap-3 sm:grid-cols-3"
    >
      {THEME_OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              active
                ? "border-primary bg-accent ring-1 ring-ring"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {option.value === "light" ? (
                <Sun className="h-4 w-4" />
              ) : option.value === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {option.label}
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.value === "light"
                  ? "Always the light palette."
                  : option.value === "dark"
                    ? "Always the dark palette."
                    : "Follow your operating system."}
              </span>
            </span>
          </button>
        );
      })}
      <p className="col-span-full flex items-center gap-1.5 text-xs text-muted-foreground">
        <MonitorCog className="h-3.5 w-3.5" />
        Saved in this browser only.
      </p>
    </div>
  );
}
