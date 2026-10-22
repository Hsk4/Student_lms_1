import Link from "next/link";

/**
 * Next.js otherwise synthesises a not-found page that reads the request. This
 * static version keeps the production prerender clean.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="text-sm text-muted-foreground">Check the address, or go back to the home page.</p>
      <Link href="/" className="btn-primary mt-2">Home</Link>
    </main>
  );
}
