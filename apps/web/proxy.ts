import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Clerk's `auth()` helper requires its middleware/proxy to have run for each
 * route. Authorization remains in layouts, pages, actions and handlers; this
 * proxy does only the Clerk session bootstrap, plus forwarding the pathname so
 * server layouts can see the active route.
 */
const withClerk = clerkMiddleware(async (_auth, request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

/**
 * Local demo sign-in (`LMS_DEMO_ROLE`).
 *
 * `lib/auth/demo.ts` accepts a `demo_<role>` session value so panels can be
 * reviewed without a Clerk sign-in. Clerk's own middleware is the obstacle: it
 * sees a `__session` that is not one of its JWTs and treats the request as
 * signed out. This proxy therefore short-circuits any `demo_` value before
 * `clerkMiddleware` ever runs — no Clerk call, no handshake, no deleted cookie.
 * It is inert unless `LMS_DEMO_ROLE` is set; the role is checked again
 * server-side against the seeded user.
 */
export default function proxy(
  request: NextRequest,
  event: Parameters<typeof withClerk>[1],
) {
  const session = request.cookies.get("__session")?.value ?? "";
  if (process.env.LMS_DEMO_ROLE && /^demo_[a-z_]+$/.test(session)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", request.nextUrl.pathname);
    // Carries the matched value to `lib/auth/demo.ts`; the request's own
    // `x-demo-session` header is dropped first so a client cannot forge it.
    requestHeaders.delete("x-demo-session");
    requestHeaders.set("x-demo-session", session);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return withClerk(request, event);
}

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
