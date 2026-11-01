"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Notice, formatDate } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { PanelLoading } from "@/lib/guards";
import { useMe } from "@/lib/queries";

export default function RejectedPage() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  useEffect(() => {
    if (!me.isFetched) return;
    if (!user) router.replace("/sign-in");
    else if (user.status !== "rejected") router.replace(user.status === "active" ? "/" : "/pending");
  }, [me.isFetched, user, router]);

  // Render nothing until a signed-in, rejected account is loaded: otherwise
  // the "declined" card (and a "no role" header) is shown to a visitor that
  // the effect is about to redirect away.
  if (!user || user.status !== "rejected") {
    return <PanelLoading />;
  }

  const rejectedAt = user?.rejectedAt ? new Date(user.rejectedAt) : null;
  const reapplyAt = rejectedAt ? new Date(rejectedAt) : null;
  reapplyAt?.setDate(reapplyAt.getDate() + 30);
  const canReapply = Boolean(reapplyAt && reapplyAt <= new Date());

  return (
    <PanelShell title="Request rejected" user={{ name: user?.name ?? "", role: user?.role ?? null }}>
      <PageHeader title="Your request was declined" />

      <Card className="space-y-4 p-6">
        {user?.rejectionReason ? (
          <Notice tone="error">Reason: {user.rejectionReason}</Notice>
        ) : (
          <Notice tone="error">No reason was recorded.</Notice>
        )}

        <p className="text-sm text-muted-foreground">
          {rejectedAt ? <>Rejected on {formatDate(rejectedAt)}. </> : null}
          {reapplyAt ? (
            canReapply ? <>You may apply again now.</> : <>You may apply again from {formatDate(reapplyAt)}.</>
          ) : null}
        </p>

        {canReapply ? (
          <Link
            href="/request"
            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover"
          >
            Apply again
          </Link>
        ) : null}
      </Card>
    </PanelShell>
  );
}
