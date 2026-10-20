export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { getFormOptions } from "@/actions/catalog-reads";
import { RequestForm } from "./request-form";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.status === "active") redirect(homeFor(user));
  if (user.status === "suspended") redirect("/?error=account_suspended");

  if (user.status === "rejected" && user.rejectedAt) {
    const reapplyAt = new Date(user.rejectedAt);
    reapplyAt.setDate(reapplyAt.getDate() + 30);
    if (reapplyAt > new Date()) redirect("/rejected");
  }

  const options = await getFormOptions();

  return (
    <PanelShell
      title="Access request"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader
        title="Request access"
        description="An admin reviews every request. You will get a role only after they approve it."
      />
      <RequestForm
        defaults={{ name: user.name, email: user.email }}
        boards={options.boards}
        levels={options.levels}
        subjects={options.subjects}
      />
    </PanelShell>
  );
}

export default function RequestPage() {
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
