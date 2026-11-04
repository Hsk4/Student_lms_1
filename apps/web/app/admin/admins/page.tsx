"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/nila";
import { useAuth } from "@/lib/auth-context";

/** Super-admin only. The API rejects every admin-only call from an admin. */
export default function AdminsPage() {
  const me = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (
      me.user &&
      (me.user.role !== "super_admin" || me.user.status !== "active")
    ) {
      router.replace(me.user.home);
    }
  }, [me.user, router]);

  return (
    <PageHeader
      title="Admins"
      description="Creating, suspending and reinstating admins lands with the super admin panel in Phase 6."
    />
  );
}
