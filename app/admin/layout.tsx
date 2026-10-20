export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Shell, type SidebarGroup } from '@/components/shell/shell';
import { checkAccess, type UserRole } from '@/lib/auth/roles';
import { countPending } from '@/lib/queries/admin';

/** Coarse panel guard: the area is gated here, each record is gated by its action. */
async function Panel({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, redirectTo } = await checkAccess(roles);
  if (redirectTo) redirect(redirectTo);

  const pending = await countPending();
  const groups: SidebarGroup[] = [
    {
      title: 'Approval',
      items: [
        { href: '/admin/requests', label: 'Requests', badge: pending },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/audit-log', label: 'Audit log' },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { href: '/admin/boards', label: 'Boards' },
        { href: '/admin/courses', label: 'Courses' },
        { href: '/admin/books', label: 'Books' },
      ],
    },
    {
      title: 'Teaching',
      items: [
        { href: '/admin/enrollments', label: 'Enrollments' },
      ],
    },
  ];

  if (user.role === 'super_admin') {
    groups.push({ title: 'Super admin', items: [{ href: '/admin/admins', label: 'Admins' }] });
  }

  return (
    <Shell
      groups={groups}
      user={{ name: user.name, email: user.email, role: user.role, status: user.status }}
    >
      {children}
    </Shell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Panel roles={['super_admin', 'admin']}>{children}</Panel>
    </Suspense>
  );
}
