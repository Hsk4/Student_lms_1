export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, Notice, PageHeader } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";
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

async function Body() {
  const user = await getCurrentUser();

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
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/sign-up" className="btn-primary">
              Create my account
            </Link>
            <Link href="/sign-in" className="btn-secondary">
              I already have one
            </Link>
          </div>
        </Card>
      </PanelShell>
    );
  }

  // Already approved: no reason to be here, send them to the code form.
  if (user.status === "active") {
    if (user.role === "parent") redirect("/parent/link");
    redirect(homeFor(user));
  }

  if (user.status === "suspended") redirect("/?error=account_suspended");

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

export default function ParentSignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Body />
    </Suspense>
  );
}
