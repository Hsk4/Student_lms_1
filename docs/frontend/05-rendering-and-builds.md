# Rendering and Build Targets

**Purpose:** explain why this app has two build targets, which pages are
server-rendered, and how to add a page without breaking the mobile app.

---

## 1. The problem this solves

The web app and the Android app are **the same code**. But they need different
things:

|                                 | Web     | Android (Capacitor)                     |
| ------------------------------- | ------- | --------------------------------------- |
| Needs search engines to read it | **Yes** | No                                      |
| Has a Next.js server            | Can     | **No** — it loads files from the device |
| Needs real HTML before JS       | **Yes** | No                                      |

A static export (`output: "export"`) gives the Android app what it needs, but it
also means every page is a client-rendered shell — which is what search engines
were seeing.

So the build is split, not the app.

```text
                    Shared Next.js App
                    (one source tree)
                           │
              ┌────────────┴────────────┐
              │                         │
             WEB                     MOBILE
              │                         │
      Normal Next build          Static export
              │                         │
       SSR / SSG / ISR                  out/
              │                         │
           Browser                   Capacitor
              │                         │
              └──────────┬──────────────┘
                         │
                    Existing API
```

---

## 2. How the split works

One environment variable decides the build:

```ts
// apps/web/next.config.ts
const isMobileBuild = process.env.NEXT_TARGET === "mobile";
```

| Command                | `NEXT_TARGET` | Output                         | Used by   |
| ---------------------- | ------------- | ------------------------------ | --------- |
| `bun run build`        | _(unset)_     | `.next/` — a normal Next build | Vercel    |
| `bun run build:mobile` | `mobile`      | `out/` — a static export       | Capacitor |

**The application code is identical in both.** No page checks which target it is
in. The only difference is whether Next is allowed to emit a server build.

> **Why not always export?** A static export cannot pre-render anything that
> needs a request, and it ships an empty shell for client-rendered pages. The
> web target fixes that; the mobile target keeps the webview working.

---

## 3. Which pages are server-rendered

| Route                                                   | Rendering                          | Why                             |
| ------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| `/`                                                     | **Server component, pre-rendered** | The page search engines index   |
| `/sign-in`, `/sign-up`, `/forgot-password`              | Client                             | Forms; no SEO value             |
| `/request`, `/pending`, `/rejected`, `/onboarding`      | Client                             | Depend on the signed-in account |
| `/admin/**`, `/teacher/**`, `/student/**`, `/parent/**` | Client                             | Private; no SEO value           |
| `/mobile`                                               | Client                             | A design reference page         |

Only `/` is server-rendered today. That is deliberate: it is the only public
page with content worth indexing. Everything else either needs a session or has
nothing to say to a crawler.

> **This is the rule to remember:** a page is server-rendered only if it has
> public content. A dashboard is never server-rendered here.

---

## 4. The landing page, in detail

`app/page.tsx` is a **server component**. It renders the marketing page to real
HTML at build time and exports metadata:

```tsx
export const metadata: Metadata = {
  title: `${SCHOOL_NAME} — One school. Everyone in the loop.`,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SCHOOL_NAME, ... },
  twitter: { card: "summary_large_image", ... },
};

export default function Home() {
  return (
    <>
      <LandingPage />
      <NativeWelcome />
    </>
  );
}
```

Two small **client islands** handle the browser-only parts:

| Component              | What it does                          | In a browser              | In the app      |
| ---------------------- | ------------------------------------- | ------------------------- | --------------- |
| `native-welcome.tsx`   | The "Welcome. Who are you?" screen    | Renders nothing           | Covers the page |
| `suspended-notice.tsx` | The `?error=account_suspended` banner | Shows if the param is set | Same            |

### Why the native welcome is a client island

`Capacitor.isNativePlatform()` only exists after the native bridge injects
`window.Capacitor`, which happens **after** hydration. Reading it during render
would make the server HTML and the first client paint disagree — a hydration
mismatch.

The existing code already solved this with `useSyncExternalStore`:

```tsx
const isNative = useSyncExternalStore(
  subscribeToPlatform,
  readIsNative,
  () => false, // server snapshot: always "browser"
);
```

The server and the first client paint both say "browser", so they match. Then
the bridge appears and the component re-renders as native. **Do not replace this
with a plain `typeof window` check** — that reintroduces the mismatch.

---

## 5. Adding a page

### A new public, SEO page

1. Create `app/<path>/page.tsx`.
2. **Do not add `"use client"`.**
3. Export `metadata` (or `generateMetadata` for dynamic routes).
4. Keep interactive parts in separate `"use client"` components.
5. Add the route to `app/sitemap.ts` if you add one.

```tsx
// app/about/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Fastly LMS",
  description: "Who we are and how the school runs on Fastly.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <main>{/* static content */}</main>;
}
```

> **Check it worked:** after `bun run build`, the page's HTML should be in
> `.next/server/app/about.html` and contain your text.

### A new private LMS page

1. Create `app/<panel>/<path>/page.tsx`.
2. Add `"use client"` at the top.
3. Fetch with `useAsync` / `useApi`.
4. Add the nav entry in `components/shell/nav-config.ts`.

The panel's `layout.tsx` already guards it.

---

## 6. What must never go in a server component here

The mobile build cannot pre-render these, so using them would break
`build:mobile`:

| Do not use                                   | Why                              |
| -------------------------------------------- | -------------------------------- |
| `cookies()`, `headers()` from `next/headers` | No request in a static export    |
| `export const dynamic = "force-dynamic"`     | Cannot be exported               |
| Route handlers (`app/**/route.ts`)           | Not supported in a static export |
| `searchParams` as a page prop                | Needs a request                  |
| Server Actions                               | Need a server                    |

If you need one of these, the page must be a **client component** — which is
what every private page already is.

> **The build will tell you.** `bun run build:mobile` fails loudly if a page
> cannot be exported. Run it before pushing any change that touches routing.

---

## 7. Verifying both targets

```bash
# Web: normal build, pre-rendered HTML
bun run --cwd apps/web build
# check: .next/server/app/index.html contains the landing text

# Mobile: static export
bun run --cwd apps/web build:mobile
# check: out/index.html exists, out/ has no server/ folder

# Then wrap it
bun run --cwd apps/web cap:sync
```

---

## 8. Common problems

| Symptom                                             | Cause                                              | Fix                                                 |
| --------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `build:mobile` fails with "Page cannot be exported" | A page uses `cookies()`, `headers()`, or `dynamic` | Make that page a client component                   |
| Hydration mismatch warning                          | Platform or storage read during render             | Use `useSyncExternalStore` with a server snapshot   |
| Landing page has no text in the HTML                | The page is `"use client"`                         | Remove it; move interactive parts into islands      |
| `out/` is missing after a build                     | You ran `build`, not `build:mobile`                | `bun run build:mobile`                              |
| The app shows the website instead of the welcome    | `window.Capacitor` is not injected                 | Check `capacitor.config.ts` and that `cap:sync` ran |

---

## 9. Related

- [Web Overview](./01-web-overview.md)
- [Pages](./02-pages.md)
- [Production deployment](../deployment/production.md)

---

## Files this document was based on

- `apps/web/next.config.ts` — the target switch
- `apps/web/package.json` — `build`, `build:mobile`, `cap:sync`
- `apps/web/scripts/build-mobile.mjs`
- `apps/web/app/page.tsx`, `app/native-welcome.tsx`
- `apps/web/components/brand/landing-sections.tsx`, `suspended-notice.tsx`
- `apps/web/capacitor.config.ts`
