"use client";

import Link from "next/link";
import { useAsync } from "@/lib/use-async";
import { Card, Empty, PageHeader } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { RedeemLinkCodeForm } from "./link-form";

type ChildRow = { id: string; name: string; boardName: string | null; levelName: string | null };

export default function ParentLinkPage() {
  const { user } = useAuth();
  const childrenQuery = useAsync(
    () => api.get<ChildRow[]>("/parent/overview"),
    [],
  );
  const children = childrenQuery.data ?? [];
  // A parent who has linked a child does not need the start-page card.
  const hasChildren = children.length > 0;

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
                    href={`/parent/children/detail?id=${child.id}`}
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

        {hasChildren ? (
          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold">Linked</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              You are following {children.length}{" "}
              {children.length === 1 ? "child" : "children"}. Open the
              dashboard to see their week.
            </p>
            <Link
              href="/parent"
              className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary mt-4"
            >
              Go to my children
            </Link>
          </Card>
        ) : (
          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold">
              {user ? "Waiting for a code?" : "Do not have an account yet?"}
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. Create an account, or sign in to the one you have.</li>
              <li>2. Ask for parent access — one click, no form to fill in.</li>
              <li>3. Once the office approves you, come back here and enter the code.</li>
            </ol>
            <Link href="/sign-up/parent" className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary mt-4">
              Parent start page
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
