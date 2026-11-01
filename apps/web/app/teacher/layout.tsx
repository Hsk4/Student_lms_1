"use client";

import { PanelShell } from "@/components/shell/panel-shell";
import { TEACHER_NAV_GROUPS } from "@/components/shell/nav-config";
import { Guarded, usePanelGuard } from "@/lib/guards";

/** Coarse guard for the teacher area (UX only; the API re-checks every call). */
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, allowed, denied, isLoading } = usePanelGuard(["teacher"]);

  return (
    <Guarded allowed={allowed} denied={denied} isLoading={isLoading}>
      <PanelShell
        panel="teacher"
        groups={TEACHER_NAV_GROUPS}
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
