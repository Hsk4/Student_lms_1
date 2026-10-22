import type { ReactNode } from "react";
import { Panel } from "@/components/shell/shell";
import { currentPathname, requirePanelUser } from "@/lib/auth/panels";

/**
 * Coarse guard for the parent area. Parents are read-only: every page filters
 * to the children linked through `student.guardianIds`.
 */
export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePanelUser("parent");
  const pathname = await currentPathname();

  return (
    <Panel
      panel="parent"
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
