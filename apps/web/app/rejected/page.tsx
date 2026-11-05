"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Notice, formatDate } from "@/components/ui/nila";
import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/shell/shell";
import { PanelLoading } from "@/lib/guards";
import { useAuth } from "@/lib/auth-context";
import { webHomeFor } from "@/lib/role-home";

export default function RejectedPage() {
  const me = useAuth();
  const router = useRouter();
  const user = me.user;

  useEffect(() => {
    if (!me.settled) return;
    if (!user) router.replace("/sign-in");
    else if (user.status !== "rejected")
      router.replace(user.status === "active" ? webHomeFor(user.home) : "/pending");
  }, [me.settled, user, router]);

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
      <header className="mb-6">
        <p className="fastly-eyebrow text-cobalt">Decision</p>
        <h1 className="fastly-display mt-2 text-[26px] text-foreground">
          Your request was declined
        </h1>
      </header>

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
          <Button asChild size="xl">
            <Link href="/request">Apply again</Link>
          </Button>
        ) : null}
      </Card>
    </PanelShell>
  );
}
