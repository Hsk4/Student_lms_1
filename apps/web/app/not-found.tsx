import Link from "next/link";

import { BrandMark } from "@/components/brand/primitives";

/**
 * Next.js otherwise synthesises a not-found page that reads the request. This
 * static version keeps the production prerender clean.
 *
 * Same two-band arrangement as the gate pages, so a mistyped URL still looks
 * like the school rather than a bare browser error.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="fastly-gate-band relative overflow-hidden">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-2 px-4 py-12 text-center">
          <BrandMark size={52} tone="light" />
          <p className="fastly-display mt-2 text-[24px] text-white">
            Page not found
          </p>
        </div>
      </header>

      <main className="relative -mt-7 flex flex-1 items-start justify-center px-4 pb-12">
        <section className="fastly-sheet self-start w-full max-w-md border-[1.5px] border-line bg-card p-7 text-center">
          <p className="fastly-display text-[44px] leading-none text-cobalt">
            404
          </p>
          <h1 className="fastly-display mt-3 text-[22px] text-foreground">
            This page does not exist
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The address may be mistyped, or the page may have moved.
          </p>
          <Link href="/" className="fastly-primary mt-6 w-full">
            Back to the home page
          </Link>
        </section>
      </main>
    </div>
  );
}
