import type { ReactNode } from "react";
import { PanelShell } from "@/components/shell/panel-shell";
import { TEACHER_NAV_GROUPS } from "@/components/shell/nav-config";
import { requirePanelUser } from "@/lib/auth/panels";

/** Coarse guard for the teacher area. Actions re-check with `requireRole`. */
export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePanelUser("teacher");

  return (
    <PanelShell
      panel="teacher"
      groups={TEACHER_NAV_GROUPS}
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
