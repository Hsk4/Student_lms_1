"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelShell } from "@/components/shell/shell";
import { PageHeader, Card } from "@/components/ui/nila";
import { useMe } from "@/lib/queries";
import { ParentOnboardingForm } from "./parent-form";

export default function ParentOnboardingPage() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  useEffect(() => {
    if (me.isLoading) return;
    if (!user) router.replace("/sign-in");
    else if (user.status !== "active" || user.role !== "student")
      router.replace(user.home);
    else if (user.onboarded) router.replace("/student");
  }, [me.isLoading, user, router]);

  return (
    <PanelShell
      title="Parent information"
      user={{ name: user?.name ?? "", role: user?.role ?? null }}
    >
      <PageHeader
        title="Add a parent or guardian"
        description="This is required before you can enter your student panel. Create a link code and share it with them."
      />
      <Card className="p-6">
        <ParentOnboardingForm />
      </Card>
    </PanelShell>
  );
}
