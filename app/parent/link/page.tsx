export const instant = false;

import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui/nila";
import { listChildOverviews } from "@/actions/parent-panel";
import { RedeemLinkCodeForm } from "./link-form";

export default async function ParentLinkPage() {
  const children = await listChildOverviews();

  return (
    <div>
      <PageHeader
        title="Link a child"
        description="Enter the code your child generated for you."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Your link code</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Codes are eight characters, work once, and expire after 14 days.
              If a code does not work, ask your child to create a new one.
            </p>
            <div className="mt-4 max-w-md">
              <RedeemLinkCodeForm />
            </div>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Already linked ({children.length})
            </h2>
            {children.length === 0 ? (
              <Empty>No child linked yet.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/parent/children/${child.id}`}
                    className="block"
                  >
                    <Card className="p-4 transition-colors duration-150 hover:bg-tint">
                      <p className="font-medium">{child.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[child.boardName, child.levelName]
                          .filter(Boolean)
                          .join(" / ") || "No board set"}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Do not have an account yet?</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Create an account, or sign in to the one you have.</li>
            <li>2. Ask for parent access — one click, no form to fill in.</li>
            <li>3. Once the office approves you, come back here and enter the code.</li>
          </ol>
          <Link href="/sign-up/parent" className="btn-secondary mt-4">
            Parent start page
          </Link>
        </Card>
      </div>
    </div>
  );
}
