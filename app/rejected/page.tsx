export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/roles";
import { PageHeader, Card, Notice, formatDate } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.status !== "rejected") {
    redirect(user.status === "active" ? "/" : "/pending");
  }

  const rejectedAt = user.rejectedAt ? new Date(user.rejectedAt) : null;
  const reapplyAt = rejectedAt ? new Date(rejectedAt) : null;
  reapplyAt?.setDate(reapplyAt.getDate() + 30);
  const canReapply = Boolean(reapplyAt && reapplyAt <= new Date());

  return (
    <PanelShell
      title="Request rejected"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader title="Your request was declined" />

      <Card className="space-y-4 p-6">
        {user.rejectionReason ? (
          <Notice tone="error">Reason: {user.rejectionReason}</Notice>
        ) : (
          <Notice tone="error">No reason was recorded.</Notice>
        )}

        <p className="text-sm text-muted-foreground">
          {rejectedAt ? <>Rejected on {formatDate(rejectedAt)}. </> : null}
          {reapplyAt ? (
            canReapply ? (
              <>You may apply again now.</>
            ) : (
              <>You may apply again from {formatDate(reapplyAt)}.</>
            )
          ) : null}
        </p>

        {canReapply ? (
          <Link href="/request" className="btn-primary">
            Apply again
          </Link>
        ) : null}
      </Card>
    </PanelShell>
  );
}

export default function RejectedPage() {
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
