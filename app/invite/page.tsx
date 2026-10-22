export const instant = false;

import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/nila";

/**
 * Old invitation links (`/invite/<id>`) still exist in inboxes from before
 * guardians were linked by code. `/invite` is the catch-all target: it explains
 * the current flow instead of 404ing, and does not block on the old token.
 */
export default function LegacyInvitePage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <PageHeader
        title="Parent invitations have changed"
        description="Guardians now link to a child with a short code instead of an email invitation."
      />
      <Card className="space-y-4 p-6 text-sm">
        <p>
          Ask your child to open <strong>Parent access</strong> in their student
          panel and create a link code. They will share the code with you
          directly.
        </p>
        <ol className="list-decimal space-y-1 ps-5 text-muted-foreground">
          <li>Sign in, or create an account if you do not have one.</li>
          <li>
            Enter the code on the <strong>Link a child</strong> page.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/sign-in" className="btn-primary">
            Sign in
          </Link>
          <Link href="/request" className="btn-secondary">
            Request access
          </Link>
        </div>
      </Card>
    </main>
  );
}
