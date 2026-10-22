import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk's auth() helper requires its middleware/proxy to have run for each route.
 * Authorization remains in layouts, pages, actions, and handlers; this proxy
 * intentionally does only the Clerk session bootstrap, plus forwarding the
 * pathname so server layouts can highlight the active navigation item.
 */
export default clerkMiddleware(async (_auth, request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

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
