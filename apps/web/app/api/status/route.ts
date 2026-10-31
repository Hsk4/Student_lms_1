import { NextResponse } from "next/server";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";

// The handler needs the request: it reads the Clerk session. Cache Components
// prerenders route handlers unless the segment opts out.
export const instant = false;

/** Reads the current session from the Mongo mirror; it must never be prerendered. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ signedIn: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      signedIn: true,
      status: user.status,
      role: user.role,
      onboarded: user.onboarded,
      home: homeFor(user),
      rejectionReason: user.rejectionReason ?? null,
      rejectedAt: user.rejectedAt ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
