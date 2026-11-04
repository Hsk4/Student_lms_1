/**
 * Theme choice shared by the inline boot script and the theme menu.
 *
 * The user's choice is applied *before* React hydrates so a dark-mode user never
 * sees a white flash. A tiny synchronous script in <head> does that, and the
 * menu only has to read/write the same key and toggle the same class.
 */
export const THEME_STORAGE_KEY = "lms-theme";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const satisfies ReadonlyArray<{ value: ThemeChoice; label: string }>;

/** `true` when `choice` should paint the `.dark` palette right now. */
export function prefersDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Default when nobody has chosen: **light**. The brand is navy ink on white,
 * and the default has to match the brand kit even on a machine whose OS is
 * set to dark. "System" stays an explicit option for anyone who wants it.
 */
export const DEFAULT_THEME: ThemeChoice = "light";

/**
 * Runs in <head> before first paint. Kept as a string (not a module) so it can
 * be inlined; it must not depend on anything from this file.
 */
export const THEME_BOOT_SCRIPT =
  "(function(){try{" +
  `var k=${JSON.stringify(THEME_STORAGE_KEY)},c=localStorage.getItem(k);` +
  'var d=c==="dark";' +
  'document.documentElement.classList.toggle("dark",d)}catch(e){}})()';
