export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { PanelShell } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { listMatchingTeachers } from '@/lib/queries/teaching';
import { listEnrollments } from '@/lib/queries/enrollment';
import { listStudentAssignments } from '@/lib/queries/assessment';
import { RequestTeacherForm, SubmitAssignmentForm } from './student-forms';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');
  if (!user.onboarded) redirect('/onboarding/parent');

  const [teachers, enrollments] = await Promise.all([
    listMatchingTeachers(user.id),
    listEnrollments({ studentId: user.id }),
  ]);
  const active = enrollments.find((item) => item.state === 'active');
  const pendingRequest = enrollments.find((item) => item.state === 'requested');
  const assignments = active ? await listStudentAssignments(user.id, active.courseId) : [];

  return (
    <PanelShell title="Student" user={{ name: user.name, role: user.role }}>
      <PageHeader
        title="My learning"
        description="Pick a teacher for a course that matches your board and level, then submit assignments."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">My teacher</h2>
      {active ? (
        <Card className="p-4 text-sm">
          <p className="font-medium">{active.teacherName}</p>
          <p className="text-muted-foreground">
            {active.courseLabel}
            {active.className ? ` / ${active.className}` : ' / one-on-one'}
          </p>
        </Card>
      ) : pendingRequest ? (
        <Empty>Request sent to {pendingRequest.teacherName}. Waiting for them to accept.</Empty>
      ) : (
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Teachers available to you</h3>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No teacher currently teaches a course matching your board and level.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {teachers.map((teacher) => (
                <div key={teacher.id} className="rounded-[var(--radius-card)] border border-border p-3">
                  <p className="font-medium">{teacher.name}</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {teacher.courses.map((course: { id: string; label: string }) => (
                      <li key={course.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{course.label}</span>
                        <RequestTeacherForm teacherId={teacher.id} courseId={course.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assignments</h2>
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
    </PanelShell>
  );
}

export default function StudentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
