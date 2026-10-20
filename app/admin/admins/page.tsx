export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/nila";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super_admin" || user.status !== "active")
    redirect(homeFor(user));

  return (
    <PageHeader
      title="Admins"
      description="Creating, suspending and reinstating admins lands with the super admin panel in Phase 6."
    />
  );
}

export default function AdminsPage() {
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
