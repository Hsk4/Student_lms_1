"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Check, Monitor, MonitorCog, Moon, Sun } from "lucide-react";
import { UserButton } from "@/lib/auth-compat";

import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  prefersDark,
  DEFAULT_THEME,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Theme state, shared with the pre-paint script in `app/layout.tsx`.
 *
 * The stored choice is read during the first render (the script already applied
 * it to `<html>`, so there is no flash), and `mounted` only gates the icon, which
 * must not depend on `localStorage` until hydration.
 */
const readStoredTheme = (): ThemeChoice | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.some((option) => option.value === stored)
    ? (stored as ThemeChoice)
    : null;
};

/** `true` once React has hydrated on the client — no state, no cascading render. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function applyTheme(next: ThemeChoice) {
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  document.documentElement.classList.toggle("dark", prefersDark(next));
}

function useThemeChoice() {
  const [theme, setThemeState] = React.useState<ThemeChoice>(
    () => readStoredTheme() ?? DEFAULT_THEME,
  );
  const mounted = useIsClient();

  React.useEffect(() => {
    // "System" must follow the OS live, not just at load time.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() === "system") {
        document.documentElement.classList.toggle("dark", media.matches);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = React.useCallback((next: ThemeChoice) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  return { theme, setTheme, mounted };
}

/** Icon for the current choice; `system` shows the OS-resolved one. */
function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  if (theme === "system") {
    return <MonitorCog className="h-5 w-5" />;
  }
  return theme === "dark" ? (
    <Moon className="h-5 w-5" />
  ) : (
    <Sun className="h-5 w-5" />
  );
}

/**
 * The plain light/dark toggle, for headers that have no room for a menu
 * (gate pages, the navy topbar). One tap flips the palette; the choice is
 * stored under the same key the boot script reads, so it survives a reload
 * and applies before first paint.
 *
 * `tone="onNavy"` draws it white for the navy bands.
 */
export function ThemeToggle({ tone = "default" }: { tone?: "default" | "onNavy" }) {
  const { theme, setTheme, mounted } = useThemeChoice();
  // Before hydration the OS-resolved value is unknowable on the server; the
  // boot script has already painted the right palette, so show the sun.
  const isDark = mounted && prefersDark(theme);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={
        tone === "onNavy"
          ? "inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-on-navy-line text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          : "inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line text-ink transition-colors hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      }
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function ThemeMenu({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, mounted } = useThemeChoice();

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Theme: light, dark or system"
          >
            {mounted ? <ThemeIcon theme={theme} /> : <Sun className="h-5 w-5" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-2">
          <ThemeList theme={theme} setTheme={setTheme} mounted={mounted} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Theme">
          {mounted ? <ThemeIcon theme={theme} /> : <Sun className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {THEME_OPTIONS.map((option) => {
          const active = mounted && theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={active ? "bg-accent text-accent-foreground" : ""}
            >
              {option.value === "system" ? (
                <Monitor className="text-muted-foreground" />
              ) : (
                <ThemeIcon theme={option.value} />
              )}
              {option.label}
              {active ? <Check className="ml-auto h-4 w-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeList({
  theme,
  setTheme,
  mounted,
}: {
  theme: ThemeChoice;
  setTheme: (value: ThemeChoice) => void;
  mounted: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex flex-col gap-0.5"
    >
      {THEME_OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-foreground hover:bg-secondary",
            )}
          >
            {option.value === "system" ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <ThemeIcon theme={option.value} />
            )}
            <span className="flex-1 text-left">{option.label}</span>
            {active ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface PageActionsProps {
  user: { name: string; email: string; role: string | null; status: string };
  /** Something small under the name in the menu (level, class, role). */
  hint?: string;
  /** Show the role/status chips in the header (admin and gated areas do). */
  showRole?: boolean;
  variant?: "full" | "compact";
}

/**
 * The right-hand cluster of a panel header: theme, help, account and Clerk's
 * `<UserButton>` (which is the real sign-out). Client component only because
 * the theme control needs `localStorage`; the user data is passed in from the
 * server layout.
 */
export function PageActions({
  user,
  hint,
  variant = "full",
}: PageActionsProps) {
  const pathname = usePathname();
  const isSettings = pathname.endsWith("/settings");

  return (
    <div className="flex items-center gap-2">
      {variant === "compact" ? <ThemeMenu compact /> : <ThemeMenu />}
      <UserMenu name={user.name} email={user.email} hint={hint}>
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          {isSettings ? "Settings open" : user.status.replace("_", " ")}
        </DropdownMenuItem>
      </UserMenu>
      <UserButton />
    </div>
  );
}
