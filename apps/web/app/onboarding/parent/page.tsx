"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelShell } from "@/components/shell/shell";
import { PageHeader, Card } from "@/components/ui/nila";
import { useMe } from "@/lib/queries";
import { ArchNumber } from "@/components/brand/primitives";
import { ParentOnboardingForm } from "./parent-form";

export default function ParentOnboardingPage() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  useEffect(() => {
    if (!me.isFetched) return;
    if (!user) router.replace("/sign-in");
    else if (user.status !== "active" || user.role !== "student")
      router.replace(user.home);
    else if (user.onboarded) router.replace("/student");
  }, [me.isFetched, user, router]);

  return (
    <PanelShell
      title="Parent information"
      user={{ name: user?.name ?? "", role: user?.role ?? null }}
    >
      <PageHeader
        title="Add a parent or guardian"
        description="This is required before you can enter your student panel. Create a link code and share it with them."
      />
      <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
        <ArchNumber n={1} size={24} tone="cobalt" />
        Create the link code
      </p>
      <Card className="p-6">
        <ParentOnboardingForm />
      </Card>
    </PanelShell>
  );
}
