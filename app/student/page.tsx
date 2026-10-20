export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { Shell, type SidebarGroup } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { listEnrollments } from '@/lib/queries/enrollment';
import { listStudentAssignments } from '@/lib/queries/assessment';
import { SubmitAssignmentForm } from './student-forms';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');
  if (!user.onboarded) redirect('/onboarding/parent');

  const enrollments = await listEnrollments({ studentId: user.id });
  const active = enrollments.find((item) => item.state === 'active');
  const pendingRequest = enrollments.find((item) => item.state === 'requested');
  const assignments = active ? await listStudentAssignments(user.id, active.courseId) : [];

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
        title="My learning"
        description="Your courses, assignments, and progress."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">My teacher</h2>
      {active ? (
        <Card className="p-4 text-sm mb-6">
          <p className="font-medium">{active.teacherName}</p>
          <p className="text-muted-foreground">
            {active.courseLabel}
            {active.className ? ` / ${active.className}` : ' / one-on-one'}
          </p>
        </Card>
      ) : pendingRequest ? (
        <Card className="p-4 text-sm mb-6 border-status-amber bg-status-amber-soft">
          <p className="text-status-amber font-medium">
            Request sent to {pendingRequest.teacherName}. Waiting for them to accept.
          </p>
        </Card>
      ) : (
        <Card className="p-4 text-sm mb-6 border-border">
          <p className="text-muted-foreground">
            No active teacher yet.{' '}
            <a href="/student/browse" className="font-medium text-primary hover:underline">
              Browse teachers →
            </a>
          </p>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assignments</h2>
      {!active ? (
        <Empty>You need an active teacher before assignments appear.</Empty>
      ) : assignments.length === 0 ? (
        <Empty>No assignments yet.</Empty>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="p-4">
              <p className="font-medium">{assignment.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {assignment.description || 'No description'}
              </p>
              {assignment.dueAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Due{' '}
                  {new Date(assignment.dueAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                </p>
              ) : null}
              {assignment.submissionId ? (
                <p className="mt-2 text-sm">
                  Submitted.{' '}
                  {assignment.score === null
                    ? 'Awaiting grade.'
                    : `Score: ${assignment.score}/100. ${assignment.feedback}`}
                </p>
              ) : (
                <div className="mt-3">
                  <SubmitAssignmentForm assignmentId={assignment.id} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

export default function StudentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
