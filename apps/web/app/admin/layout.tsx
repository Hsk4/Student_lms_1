export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PanelShell } from "@/components/shell/panel-shell";
import {
  ADMIN_SUPER_NAV,
  ADMIN_NAV_GROUPS,
  type NavGroup,
} from "@/components/shell/nav-config";
import { checkAccess, type UserRole } from "@/lib/auth/roles";
import { countPending } from "@/lib/queries/admin";

/**
 * Coarse panel guard: the area is gated here, each record is gated by its action.
 * The layout must be `async` — a non-async layout whose guard is awaited inside a
 * `<Suspense>` boundary streams the fallback and, for an anonymous visitor,
 * never settles, so `/admin` would show "Loading..." forever instead of
 * redirecting. Awaiting here resolves the session before anything streams.
 */
async function Panel({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, redirectTo } = await checkAccess(roles);
  if (redirectTo) redirect(redirectTo);

  const pending = await countPending();
  const groups: NavGroup[] =
    user.role === "super_admin"
      ? [
          ...ADMIN_NAV_GROUPS,
          { title: "Super admin", items: [ADMIN_SUPER_NAV] },
        ]
      : ADMIN_NAV_GROUPS;

  return (
    <PanelShell
      panel="admin"
      groups={groups}
      badges={{ pending }}
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }}
    >
      {children}
    </PanelShell>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Panel roles={["super_admin", "admin"]}>{children}</Panel>
    </Suspense>
  );
}
