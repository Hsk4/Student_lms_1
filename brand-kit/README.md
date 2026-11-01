# Fastly brand kit

```
logo/               mark (cobalt, navy, white, mono), lockups, stacked, favicon: all SVG, wordmark outlined from Fraunces
patterns/           jaali-light.svg, jaali-dark.svg (tile, 56 px repeat)
illustrations/      hero-arch, role-student, role-teacher, role-parent, pending-arch
png/                icon-1024, android adaptive fg/bg 432, pwa 192/512, apple-touch-180, favicon 32/48, og-1200x630, hero-arch-1280
capacitor-assets/   icon-only, icon-foreground, icon-background, splash, splash-dark (input for @capacitor/assets)
PROMPTS.md          design-tool, image-generator and logo-exploration prompts
```

## Where things go in `Student_lms_1`

1. **Static files.** Copy `logo/`, `patterns/`, `illustrations/` into `apps/web/public/brand/`.
   Favicon and share images use Next's file convention: `apps/web/app/icon.svg` (the favicon SVG),
   `apps/web/app/apple-icon.png` (apple-touch-180), `apps/web/app/opengraph-image.png` (og-1200x630).
2. **Android icon and splash.** Copy `capacitor-assets/*` to `apps/web/assets/`, then in `apps/web`:
   `bunx @capacitor/assets generate --android`, followed by `bun run cap:sync`.
   This replaces the default launcher icons in `android/app/src/main/res`. Add `@capacitor/splash-screen`
   if you want the native splash to show.
3. **Tokens in `app/globals.css`.**
   - `--navy` is currently `var(--primary)`. Decouple it first: `--navy: #0A2540;`. Otherwise the next step turns the sidebar blue.
   - Then `--primary: #1E4DB7; --primary-hover: #173D94;`.
   - Add `--spark: #F4B942;` and `--color-spark: var(--spark);` in `@theme inline`.
   - Add the display face: `Fraunces` from `next/font/google` in `layout.tsx` as `--font-fraunces`, and
     `--font-display: var(--font-fraunces), Georgia, serif;` in `@theme inline`. Headlines get `font-display`.
   - Dark mode needs no change: navy, spark and the pattern all read fine on black. Run `bun run lint:colors` afterwards.
4. **Landing page (`app/page.tsx`).** Rebuild it in sections that follow the canvas: hero, roles, how it works,
   product peek, features, parents code, boards, closing banner, footer. Put them in `views/landing/` so `page.tsx`
   stays a short composition. Note the current buttons render with no padding (see `qa/check-landing.png`): use the
   existing `Button` from `components/ui/button.tsx` rather than bare classes on `Link`.
5. **App entry.** In the Capacitor build, show the welcome screen (three role rows) instead of the marketing page:
   `Capacitor.isNativePlatform()` from `@capacitor/core`, with the web landing kept for browsers.
   On phones the student layout already scrolls tabs; replace it with the five-item bottom bar from `App-Home`.
6. **Images.** Photos come from `PROMPTS.md`. Put them under `public/photos/`, mask them with the arch shape, and compress to WebP.

## Placeholders to fill

`[SCHOOL NAME]`, `[SCHOOL PHONE OR EMAIL]`, the sample student name, teacher names and every number in the mockups.
They are samples, not data.

## Fonts

Fraunces and Inter are open licensed (SIL OFL) and come from Google Fonts.
