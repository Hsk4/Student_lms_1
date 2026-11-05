"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/shell/shell";
import { useAuth } from "@/lib/auth-context";
import { webHomeFor } from "@/lib/role-home";
import { SignUp } from "@/lib/auth";
import { RequestParentRoleButton } from "./parent-actions";

/*
 * The guardian entry point, for signed-out and signed-in visitors alike.
 *
 * Signed out, "I am a parent" used to open an explainer that sent the visitor
 * to a generic sign-up form and then back here — three screens to answer one
 * question, and the parent application was never the thing they landed on.
 * The account form is now the first thing on the page, and it says what
 * happens next; once signed in, the same page is the parent application.
 */

const STEPS = [
  {
    title: "Create your account",
    detail: "Use the email you want to receive school messages on.",
  },
  {
    title: "Tell us who your child is",
    detail: "Name, the email or student code they use, and your relationship.",
  },
  {
    title: "Enter your child's link code",
    detail:
      "After approval, the 8-character code your child gives you links you.",
  },
];

export default function ParentSignUpPage() {
  const me = useAuth();
  const router = useRouter();
  const user = me.user;

  /*
   * Only accounts that are already *parents* are sent away: that is the
   * guardian who is done. A signed-in account with no role stays on the
   * application below, and one holding another role is told so rather than
   * being bounced mid-form.
   */
  useEffect(() => {
    if (me.loading || !user) return;
    if (user.status === "suspended") {
      router.replace("/?error=account_suspended");
    } else if (user.role === "parent") {
      router.replace(webHomeFor(user.home));
    }
  }, [me.loading, user, router]);

  if (!user) {
    return (
      <PanelShell title="Parents">
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader
            title="Join as a parent"
            description="Guardians get a read-only view of their child's progress, attendance and fees."
          />

          <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-start">
            <Card className="p-6">
              <ol className="space-y-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <ArchNumber n={index + 1} size={30} tone="cobalt" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                Already approved?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </Card>

            {/* The account form is the first step, not a link to it. */}
            <div className="flex justify-center">
              <SignUp signInUrl="/sign-in" role="parent" />
            </div>
          </div>
        </div>
      </PanelShell>
    );
  }

  /*
   * A parent who is already approved has been redirected above; this is the
   * "signed in, still needs to ask" state. An account that already holds a
   * different role cannot ask for parent access (the API refuses it), so it is
   * pointed at its own panel instead of a button that would only error.
   */
  if (user.role) {
    return (
      <PanelShell title="Parents" user={{ name: user.name, role: user.role }}>
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader
            title={`Welcome, ${user.name}`}
            description="This account already has a role."
          />
          <Card className="space-y-4 p-6">
            <Notice>
              Parent access is for guardian accounts. This account is signed in
              as a {user.role.replace("_", " ")}, so it opens its own panel
              instead.
            </Notice>
            <Button asChild size="xl">
              <Link href={webHomeFor(user.home)}>Go to my panel</Link>
            </Button>
          </Card>
        </div>
      </PanelShell>
    );
  }

  const reapplyAt =
    user.status === "rejected" && user.rejectedAt
      ? (() => {
          const date = new Date(user.rejectedAt);
          date.setDate(date.getDate() + 30);
          return date > new Date()
            ? date.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })
            : null;
        })()
      : null;

  return (
    <PanelShell title="Parents" user={{ name: user.name, role: user.role }}>
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader
          title="Request parent access"
          description="Tell the school office who your child is. A parent dashboard opens once they approve you."
        />
        <Card className="space-y-4 p-6">
          <div className="text-sm">
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>

          <Notice>
            Asking for parent access sends your request to the school office.
            You will get the parent role only after they approve it.
          </Notice>

          <RequestParentRoleButton reapplyAt={reapplyAt} />

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Prefer to give the office more detail up front?{" "}
              <Link
                href="/request?role=parent"
                className="font-medium text-primary hover:underline"
              >
                Open the full parent application
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>
    </PanelShell>
  );
}
