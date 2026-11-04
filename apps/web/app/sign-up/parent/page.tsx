"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/shell/shell";
import { useMe } from "@/lib/queries";
import { RequestParentRoleButton } from "./parent-actions";

const STEPS = [
  {
    title: "Create your account",
    detail: "Use the email you want to receive school messages on.",
  },
  {
    title: "Ask for parent access",
    detail: "One click. The school office reviews it, usually the same day.",
  },
  {
    title: "Enter your child's code",
    detail: "Your child gives you an 8-character code. That links you to them.",
  },
];

export default function ParentSignUpPage() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  useEffect(() => {
    if (me.isLoading || !user) return;
    if (user.status === "active") {
      router.replace(user.role === "parent" ? "/parent/link" : user.home);
    } else if (user.status === "suspended") {
      router.replace("/?error=account_suspended");
    }
  }, [me.isLoading, user, router]);

  // Signed out: this page is the guardian entry point and explains the flow.
  if (!user) {
    return (
      <PanelShell title="Parents">
        <PageHeader
          title="Join as a parent"
          description="Guardians get a read-only view of their child's progress, attendance and fees."
        />
        <Card className="p-6">
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <ArchNumber n={index + 1} size={30} tone="cobalt" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="xl">
              <Link href="/sign-up">Create my account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">I already have one</Link>
            </Button>
          </div>
        </Card>
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
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="One last step before a school admin reviews your account."
      />
      <Card className="space-y-4 p-6">
        <div className="text-sm">
          <p className="font-medium text-foreground">{user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        <Notice>
          Asking for parent access sends your request to the school office. You
          will get the parent role only after they approve it.
        </Notice>

        <RequestParentRoleButton reapplyAt={reapplyAt} />

        <p className="text-xs text-muted-foreground">
          Approving a parent does not link a child on its own. Once you are
          approved, you enter the code your child generated under{" "}
          <strong>Link a child</strong>.
        </p>
      </Card>
    </PanelShell>
  );
}
