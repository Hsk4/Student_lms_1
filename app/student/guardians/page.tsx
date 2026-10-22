export const instant = false;

import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
import { listMyGuardians } from "@/actions/parent";
import { CreateParentLinkForm, RevokeParentLinkButton } from "../student-forms";

export default async function StudentGuardiansPage() {
  const guardians = await listMyGuardians();

  return (
    <div>
      <PageHeader
        title="Parent access"
        description="Your guardians see your progress and fees, read-only. You can link more than one."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guardians and open codes ({guardians.length})
          </h2>
          {guardians.length === 0 ? (
            <Empty>
              No guardian linked yet. Create a link code on the right.
            </Empty>
          ) : (
            <div className="space-y-2">
              {guardians.map((guardian) => (
                <Card
                  key={guardian.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {guardian.name ?? guardian.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {guardian.email || "No email recorded"}
                    </p>
                    {guardian.code ? (
                      <p className="mt-1 font-mono text-sm tracking-[0.2em]">
                        {guardian.code}
                        {guardian.expiresAt ? (
                          <span className="ms-2 font-sans text-xs tracking-normal text-muted-foreground">
                            expires {formatDay(guardian.expiresAt)}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={toneFor(guardian.state)}>
                      {guardian.state === "sent"
                        ? "Code active"
                        : guardian.state}
                    </Chip>
                    {guardian.state === "sent" ? (
                      <RevokeParentLinkButton inviteId={guardian.id} />
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            No email is sent. Share the code with your guardian directly. They
            sign in to their own account and enter it under &quot;Link a
            child&quot;. A guardian who has no account yet must sign up first
            and wait for the office to approve it — see{" "}
            <Link
              href="/sign-up/parent"
              className="font-medium text-primary hover:underline"
            >
              the parent start page
            </Link>
            .
          </p>
        </section>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Create a link code</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valid for 14 days and works once.
          </p>
          <div className="mt-4">
            <CreateParentLinkForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
