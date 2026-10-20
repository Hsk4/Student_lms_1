import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk's auth() helper requires its middleware/proxy to have run for each route.
 * Authorization remains in layouts, pages, actions, and handlers; this proxy
 * intentionally does only the Clerk session bootstrap.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static files, but include API routes (webhooks use no auth()).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Clerk path-based sign-in/up components require requests for all catch-all subroutes.
    "/(sign-in|sign-up)(.*)",
    // Always run for API and tRPC routes.
    "/(api|trpc)(.*)",
  ],
};
