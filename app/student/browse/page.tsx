export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { Shell, type SidebarGroup } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { listMatchingTeachers } from '@/lib/queries/teaching';
import { listEnrollments } from '@/lib/queries/enrollment';
import { RequestTeacherForm } from './student-forms';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');
  if (!user.onboarded) redirect('/onboarding/parent');

  const [teachers, enrollments] = await Promise.all([
    listMatchingTeachers(user.id),
    listEnrollments({ studentId: user.id }),
  ]);
  
  const activeEnrollment = enrollments.find((item) => item.state === 'active');
  const pendingRequest = enrollments.find((item) => item.state === 'requested');

  const groups: SidebarGroup[] = [
    {
      title: 'Learning',
      items: [
        { href: '/student', label: 'My dashboard' },
        { href: '/student/browse', label: 'Browse teachers' },
        { href: '/student/materials', label: 'Materials' },
        { href: '/student/quizzes', label: 'Quizzes' },
      ],
    },
    {
      title: 'Account',
      items: [
        { href: '/student/invoices', label: 'Invoices' },
        { href: '/student/books', label: 'Books' },
        { href: '/student/support', label: 'Support' },
      ],
    },
  ];

  return (
    <Shell groups={groups} user={{ name: user.name, email: user.email, role: user.role, status: user.status }}>
      <PageHeader
        title="Browse teachers"
        description="View available teachers and send requests for courses matching your board and level."
      />

      {activeEnrollment ? (
        <div className="mb-6 rounded-[var(--radius-card)] border border-status-green bg-status-green-soft p-4">
          <p className="text-sm font-medium text-status-green">
            You're already enrolled with {activeEnrollment.teacherName} for {activeEnrollment.courseLabel}
          </p>
        </div>
      ) : null}

      {pendingRequest ? (
        <div className="mb-6 rounded-[var(--radius-card)] border border-status-amber bg-status-amber-soft p-4">
          <p className="text-sm font-medium text-status-amber">
            You have a pending request to {pendingRequest.teacherName}. Waiting for acceptance...
          </p>
        </div>
      ) : null}

      {teachers.length === 0 ? (
        <Empty>No teachers currently teach courses matching your board and level.</Empty>
      ) : (
        <div className="space-y-4">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{teacher.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">Available courses:</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {teacher.courses.map((course: { id: string; label: string }) => (
                  <div key={course.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <span className="text-sm font-medium">{course.label}</span>
                    <RequestTeacherForm teacherId={teacher.id} courseId={course.id} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

export default function StudentBrowsePage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
