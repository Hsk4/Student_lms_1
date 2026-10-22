import type { ReactNode } from "react";
import { Panel } from "@/components/shell/shell";
import { currentPathname, requirePanelUser } from "@/lib/auth/panels";

/** Coarse guard for the teacher area. Actions re-check with `requireRole`. */
export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePanelUser("teacher");
  const pathname = await currentPathname();

  return (
    <Panel
      panel="teacher"
      activeHref={pathname}
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }}
    >
      {children}
    </Panel>
  );
}
