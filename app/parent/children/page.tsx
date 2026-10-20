export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Enrollment } from '@/models/enrollment';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'parent' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const parent = await User.findOne({ clerkId: user.clerkId }).lean();

  const children = await User.find({
    'student.guardianIds': parent?._id,
  }).lean();

  const perChild = await Promise.all(
    children.map(async (child) => {
      const enrollments = await Enrollment.find({
        studentId: child._id,
        state: 'active',
      })
        .populate('teacherId', 'name')
        .populate('courseId', 'name')
        .lean();

      return {
        id: String(child._id),
        name: child.name,
        enrollments,
      };
    })
  );

  return (
    <div>
      <PageHeader
        title="My children"
        description="View your children's courses and teachers."
      />

      {perChild.length === 0 ? (
        <Empty>No linked children yet.</Empty>
      ) : (
        <div className="space-y-6">
          {perChild.map((child) => (
            <div key={child.id}>
              <h2 className="mb-3 text-lg font-semibold">{child.name}</h2>

              {child.enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active courses yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {child.enrollments.map((enr: any) => (
                    <Card key={String(enr._id)} className="p-4">
                      <p className="font-medium">{enr.courseId?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Teacher: {enr.teacherId?.name}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentChildrenPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
