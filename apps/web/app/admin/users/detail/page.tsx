"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { UserDetailView } from "./user-detail-view";
import { InlineLoading } from "@/components/shared/skeleton";

/**
 * Static export cannot prerender an unknown id, so the id is a query param:
 * `/admin/users/detail/?id=...`, read inside a Suspense boundary.
 */
function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";

  const userQuery = useAsync(
    () =>
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
    [id],
    { enabled: Boolean(id) },
  );
  const { user: me } = useAuth();

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No user selected.</p>
    );
  if (userQuery.loading)
    return <InlineLoading />;
  if (userQuery.error) {
    return (
      <p className="p-6 text-sm text-status-red">{userQuery.error.message}</p>
    );
  }
  if (!userQuery.data) return null;

  const user = userQuery.data;
  const actorRole = me?.role ?? null;
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