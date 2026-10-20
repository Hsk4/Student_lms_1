export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { getCurrentUser } from "@/lib/auth/roles";
import {
  PageHeader,
  Card,
  RoleChip,
  StatusChip,
  formatDate,
} from "@/components/ui/nila";
import { UserActions } from "./user-actions";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentUser();

  await connectDB();
  const user = await User.findById(id).lean();
  if (!user) notFound();

  const canManage =
    actor?.role === "super_admin"
      ? user.role !== "super_admin"
      : user.role !== "super_admin" && user.role !== "admin";

  return (
    <>
      <PageHeader title={user.name} description={user.email}>
        <Link href="/admin/users" className="btn-secondary">
          Back to users
        </Link>
      </PageHeader>

      <Card className="p-5">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="mt-1">
              <RoleChip role={user.role ?? null} />
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
          <UserActions
            userId={String(user._id)}
            status={user.status}
            role={user.role ?? null}
          />
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
