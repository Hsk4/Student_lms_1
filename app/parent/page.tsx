export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { PanelShell } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { listEnrollments } from '@/lib/queries/enrollment';
import { listMyChildren } from '@/actions/teacher';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'parent' || user.status !== 'active') redirect('/pending');

  const children = await listMyChildren();
  const perChild = await Promise.all(
    children.map(async (child) => {
      const enrollments = await listEnrollments({ studentId: String(child._id) });
      return {
        id: String(child._id),
        name: child.name,
        active: enrollments.find((item) => item.state === 'active'),
        requested: enrollments.find((item) => item.state === 'requested'),
      };
    })
  );

  return (
    <PanelShell title="Parent" user={{ name: user.name, role: user.role }}>
      <PageHeader title="Your children" description="Read-only view of each child's teacher and course." />
      {perChild.length === 0 ? (
        <Empty>No linked children yet. Ask your child to send you an invitation.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {perChild.map((child) => (
            <Card key={child.id} className="p-4">
              <h2 className="font-medium">{child.name}</h2>
              {child.active ? (
                <>
                  <p className="mt-1 text-sm">{child.active.courseLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    Teacher: {child.active.teacherName} / {child.active.className ?? 'one-on-one'}
                  </p>
                </>
              ) : child.requested ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Request sent to {child.requested.teacherName}, awaiting acceptance.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No teacher yet.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

export default function ParentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
