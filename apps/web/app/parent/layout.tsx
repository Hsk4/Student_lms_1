import type { ReactNode } from "react";
import { PanelShell } from "@/components/shell/panel-shell";
import { PARENT_NAV_GROUPS } from "@/components/shell/nav-config";
import { requirePanelUser } from "@/lib/auth/panels";

/**
 * Coarse guard for the parent area. Parents are read-only: every page filters
 * to the children linked through `guardianships`. On phones the reference kit
 * uses a bottom tab bar instead of a slide-over, so `mobile` says so.
 */
export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePanelUser("parent");

  return (
    <PanelShell
      panel="parent"
      groups={PARENT_NAV_GROUPS}
      mobile="bottom-tabs"
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
