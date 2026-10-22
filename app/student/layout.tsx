import type { ReactNode } from "react";
import { Panel } from "@/components/shell/shell";
import { currentPathname, requirePanelUser } from "@/lib/auth/panels";

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
  const pathname = await currentPathname();

  return (
    <Panel
      panel="student"
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
