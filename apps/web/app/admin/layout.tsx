"use client";

import { PanelShell } from "@/components/shell/panel-shell";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_SUPER_NAV,
  type NavGroup,
} from "@/components/shell/nav-config";
import { Guarded, usePanelGuard } from "@/lib/guards";

/**
 * Coarse guard for the admin area (UX only; the API is the real gate). A
 * super admin also gets the Admins entry.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, allowed, denied, isLoading } = usePanelGuard(["super_admin", "admin"]);

  const groups: NavGroup[] =
    user?.role === "super_admin"
      ? [
          ...ADMIN_NAV_GROUPS,
          { title: "Super admin", items: [ADMIN_SUPER_NAV] },
        ]
      : ADMIN_NAV_GROUPS;

  return (
    <Guarded allowed={allowed} denied={denied} isLoading={isLoading}>
      <PanelShell
        panel="admin"
        groups={groups}
        badges={{ pending: user?.pendingRequests ?? 0 }}
        user={{
          name: user?.name ?? "",
          email: user?.email ?? "",
          role: user?.role ?? null,
          status: user?.status ?? "pending",
        }}
      >
        {children}
      </PanelShell>
    </Guarded>
  );
}
