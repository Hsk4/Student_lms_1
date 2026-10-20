export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { User } from '@/models/user';
import { Enrollment } from '@/models/enrollment';
import { Submission } from '@/models/submission';
import { connectDB } from '@/lib/db';

async function Body() {
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  await connectDB();

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    students,
    teachers,
    enrollments,
    completedSubmissions,
    averageGrade,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'pending' }),
    User.countDocuments({ role: 'student', status: 'active' }),
    User.countDocuments({ role: 'teacher', status: 'active' }),
    Enrollment.countDocuments({ state: 'active' }),
    Submission.countDocuments({ score: { $ne: null } }),
    Submission.aggregate([
      { $match: { score: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]),
  ]);

  const avgGrade = averageGrade[0]?.avg ?? 0;

  const stats = [
    { label: 'Total users', value: totalUsers },
    { label: 'Active', value: activeUsers },
    { label: 'Pending approval', value: pendingUsers },
    { label: 'Students (active)', value: students },
    { label: 'Teachers (active)', value: teachers },
    { label: 'Active enrollments', value: enrollments },
    { label: 'Submissions graded', value: completedSubmissions },
    { label: 'Avg grade', value: `${avgGrade.toFixed(1)}/100` },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="System-wide metrics from MongoDB."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 text-center">
            <p className="text-2xl font-semibold text-primary">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Distribution by role
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-sm text-muted-foreground">
          Role breakdown chart coming soon (Charts.js or Recharts).
        </p>
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Enrollment trends
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-sm text-muted-foreground">
          Monthly enrollment and submission trends coming soon.
        </p>
      </Card>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
