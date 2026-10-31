export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/roles";
import { PanelShell } from "@/components/shell/shell";
import { PageHeader, Card } from "@/components/ui/nila";
import { ParentOnboardingForm } from "./parent-form";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.status !== "active" || user.role !== "student") redirect("/pending");
  if (user.onboarded) redirect("/student");

  return (
    <PanelShell
      title="Parent information"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader
        title="Add a parent or guardian"
        description="This is required before you can enter your student panel. We will send them an invite to join."
      />
      <Card className="p-6">
        <ParentOnboardingForm />
      </Card>
    </PanelShell>
  );
}

export default function ParentOnboardingPage() {
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
