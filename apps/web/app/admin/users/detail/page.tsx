"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useMe } from "@/lib/queries";
import { UserDetailView } from "./user-detail-view";
import { InlineLoading } from "@/components/shared/skeleton";

/**
 * Static export cannot prerender an unknown id, so the id is a query param:
 * `/admin/users/detail/?id=...`, read inside a Suspense boundary.
 */
function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";

  const userQuery = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () =>
      api.get<{
        id: string;
        clerkId: string;
        name: string;
        email: string;
        role: string | null;
        status: string;
        onboarded: boolean;
        createdAt: string;
        rejectedAt: string | null;
        rejectionReason: string | null;
      }>(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
  const me = useMe();

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No user selected.</p>
    );
  if (userQuery.isLoading)
    return <InlineLoading />;
  if (userQuery.error) {
    return (
      <p className="p-6 text-sm text-status-red">{userQuery.error.message}</p>
    );
  }
  if (!userQuery.data) return null;

  const user = userQuery.data;
  const actorRole = me.data?.role ?? null;
  const canManage =
    actorRole === "super_admin"
      ? user.role !== "super_admin"
      : user.role !== "super_admin" && user.role !== "admin";

  return <UserDetailView user={user} canManage={canManage} />;
}

export default function AdminUserDetailPage() {
  return (
    <Suspense
      fallback={<InlineLoading />}
    >
      <DetailById />
    </Suspense>
  );
}