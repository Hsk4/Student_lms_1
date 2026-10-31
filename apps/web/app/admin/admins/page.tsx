"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/nila";
import { useMe } from "@/lib/queries";

/** Super-admin only. The API rejects every admin-only call from an admin. */
export default function AdminsPage() {
  const me = useMe();
  const router = useRouter();

  useEffect(() => {
    if (
      me.data &&
      (me.data.role !== "super_admin" || me.data.status !== "active")
    ) {
      router.replace(me.data.home);
    }
  }, [me.data, router]);

  return (
    <PageHeader
      title="Admins"
      description="Creating, suspending and reinstating admins lands with the super admin panel in Phase 6."
    />
  );
}
