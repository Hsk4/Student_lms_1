"use client";

import { PanelShell } from "@/components/shell/panel-shell";
import { STUDENT_NAV_GROUPS } from "@/components/shell/nav-config";
import { Guarded, usePanelGuard } from "@/lib/guards";

/** Coarse guard for the student area; a student who has not onboarded is sent away. */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, allowed, isLoading } = usePanelGuard(["student"]);

  return (
    <Guarded allowed={allowed} isLoading={isLoading}>
      <PanelShell
        panel="student"
        groups={STUDENT_NAV_GROUPS}
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
