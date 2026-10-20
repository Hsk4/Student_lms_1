export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/roles";
import { PageHeader, Card, Notice } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { getOwnRequestStatus } from "@/actions/onboarding";
import { PendingPoller } from "./pending-poller";

const STEPS = ["Account created", "Request under review", "Access granted"];

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.status !== "pending") {
    redirect(
      user.status === "active"
        ? user.onboarded
          ? user.role === "super_admin" || user.role === "admin"
            ? "/admin"
            : `/${user.role}`
          : "/onboarding/parent"
        : user.status === "rejected"
          ? "/rejected"
          : "/?error=account_suspended",
    );
  }

  const status = await getOwnRequestStatus();

  return (
    <PanelShell
      title="Waiting for approval"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader
        title="Your account is pending"
        description="An admin has to approve you before you can use the school. This page updates on its own."
      />

      <Card className="p-6">
        <ol className="space-y-4">
          {STEPS.map((step, index) => {
            const done =
              index === 0
                ? true
                : index === 1
                  ? Boolean(status?.hasOpenRequest)
                  : false;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step}</p>
                  <p className="text-xs text-muted-foreground">
                    {index === 0
                      ? "Signed in with Clerk."
                      : index === 1
                        ? status?.hasOpenRequest
                          ? "Submitted. Nothing else to do."
                          : "Submit the access request first."
                        : "You will be sent to your panel."}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {!status?.hasOpenRequest ? (
          <div className="mt-6 space-y-3">
            <Notice tone="info">
              You have not sent an access request yet.
            </Notice>
            <a href="/request" className="btn-primary">
              Fill in the request form
            </a>
          </div>
        ) : null}
      </Card>

      <PendingPoller />
    </PanelShell>
  );
}

export default function PendingPage() {
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
