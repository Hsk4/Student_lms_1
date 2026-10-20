export const instant = false;

import { Suspense } from "react";
import { getInviteDetails } from "@/actions/parent";
import { getCurrentUser } from "@/lib/auth/roles";
import { PanelShell } from "@/components/shell/shell";
import { Card, PageHeader, Notice } from "@/components/ui/nila";

async function Body({ invitationId }: { invitationId: string }) {
  const [invite, user] = await Promise.all([
    getInviteDetails(invitationId),
    getCurrentUser(),
  ]);

  return (
    <PanelShell
      title="Parent invitation"
      user={user ? { name: user.name, role: user.role } : undefined}
    >
      <PageHeader title="Parent invitation" />
      <Card className="space-y-4 p-6">
        {!invitationId ? (
          <Notice tone="error">This Clerk invitation link is missing its invitation id.</Notice>
        ) : !invite ? (
          <Notice tone="error">
            This invite is invalid, expired, or has already been used.
          </Notice>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{invite.parentName}</strong>,
              you have been invited by{" "}
              <strong className="text-foreground">{invite.studentName}</strong>{" "}
              to join their learning account.
            </p>
            <p className="text-sm text-muted-foreground">
              Invitation sent to {invite.parentEmail}. The invitation expires after seven days.
            </p>
            <Notice>
              {invite.message ?? "Invitation sent. Check your email to finish Clerk sign-up."}
            </Notice>
            <p className="text-sm text-muted-foreground">Use the Clerk invitation email to complete sign-up. After sign-up, the Clerk webhook activates and links the parent account.</p>
          </>
        )}
      </Card>
    </PanelShell>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: invitationId } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Body invitationId={invitationId} />
    </Suspense>
  );
}
