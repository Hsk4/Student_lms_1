"use client";

import Link from "next/link";
import {
  Card,
  PageHeader,
  RoleChip,
  StatusChip,
  formatDate,
} from "@/components/ui/nila";
import { UserActions } from "./user-actions";

export type AdminUserDetail = {
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
};

export function UserDetailView({
  user,
  canManage,
}: {
  user: AdminUserDetail;
  canManage: boolean;
}) {
  return (
    <>
      <PageHeader title={user.name} description={user.email}>
        <Link
          href="/admin/users"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
          Back to users
        </Link>
      </PageHeader>

      <Card className="p-5">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="mt-1">
              <RoleChip role={user.role} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <StatusChip status={user.status} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Onboarded</dt>
            <dd className="mt-1">{user.onboarded ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Joined</dt>
            <dd className="mt-1">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Clerk id</dt>
            <dd className="mt-1 break-all font-mono text-xs">{user.clerkId}</dd>
          </div>
          {user.rejectedAt ? (
            <div>
              <dt className="text-muted-foreground">Rejected</dt>
              <dd className="mt-1">
                {formatDate(user.rejectedAt)}
                {user.rejectionReason ? ` - ${user.rejectionReason}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mt-6">
        {canManage ? (
          <UserActions userId={user.id} status={user.status} role={user.role} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This account is protected. Only a super admin may change admins, and
            nobody may change the super admin.
          </p>
        )}
      </div>
    </>
  );
}
