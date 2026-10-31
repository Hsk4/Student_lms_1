import type { ReactNode } from "react";
import { PanelShell } from "@/components/shell/panel-shell";
import { STUDENT_NAV_GROUPS } from "@/components/shell/nav-config";
import { requirePanelUser } from "@/lib/auth/panels";

/**
 * Coarse guard for the whole student area. Each page still applies a row guard
 * to the records it reads, and every server action re-checks with `requireRole`.
 */
export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePanelUser("student");

  return (
    <PanelShell
      panel="student"
      groups={STUDENT_NAV_GROUPS}
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
