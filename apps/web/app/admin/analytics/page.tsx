export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { StatStrip } from '@/components/shared/stat-strip';
import { PageHeader, Card } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { and, avg, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { enrollments, submissions, users } from '@/db/schema';



async function Body() {
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    students,
    teachers,
    activeEnrollmentCount,
    completedSubmissions,
    gradeRow,
  ] = await Promise.all([
    db.$count(users),
    db.$count(users, eq(users.status, 'active')),
    db.$count(users, eq(users.status, 'pending')),
    db.$count(users, and(eq(users.role, 'student'), eq(users.status, 'active'))),
    db.$count(users, and(eq(users.role, 'teacher'), eq(users.status, 'active'))),
    db.$count(enrollments, eq(enrollments.state, 'active')),
    db.$count(submissions, isNotNull(submissions.score)),
    // Was an aggregation pipeline with `$avg`; that is `avg()` in SQL.
    db
      .select({ value: avg(submissions.score) })
      .from(submissions)
      .where(isNotNull(submissions.score)),
  ]);

  const avgGrade = Number(gradeRow[0]?.value ?? 0);

  const stats = [
    { label: 'Total users', value: totalUsers },
    { label: 'Active', value: activeUsers },
    { label: 'Pending approval', value: pendingUsers },
    { label: 'Students (active)', value: students },
    { label: 'Teachers (active)', value: teachers },
    { label: 'Active enrollments', value: activeEnrollmentCount },
    { label: 'Submissions graded', value: completedSubmissions },
    { label: 'Avg grade', value: `${avgGrade.toFixed(1)}/100` },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="System-wide metrics from the database."
      />

      <StatStrip items={stats} />

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
