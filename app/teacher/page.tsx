export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { PanelShell } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { listEnrollments } from '@/lib/queries/enrollment';
import { listTeacherClasses, listCourseChoicesForTeacher } from '@/lib/queries/teaching';
import { DecisionForm, ClassForm } from './teacher-forms';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'teacher' || user.status !== 'active') redirect('/pending');

  const [requests, active, classes, courseChoices] = await Promise.all([
    listEnrollments({ teacherId: user.id, state: 'requested' }),
    listEnrollments({ teacherId: user.id, state: 'active' }),
    listTeacherClasses(user.id),
    listCourseChoicesForTeacher(user.id),
  ]);

  return (
    <PanelShell title="Teacher" user={{ name: user.name, role: user.role }}>
      <PageHeader
        title="Teaching"
        description="Accept student requests as a class or one-on-one, then publish assignments."
      >
        <a href="/teacher/assignments" className="btn-primary">Assignments</a>
      </PageHeader>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Student requests ({requests.length})
      </h2>
      {requests.length === 0 ? (
        <Empty>No pending requests.</Empty>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="p-4">
              <p className="font-medium">{request.studentName}</p>
              <p className="text-sm text-muted-foreground">{request.studentEmail}</p>
              <p className="mt-1 text-sm">{request.courseLabel}</p>
              <div className="mt-3">
                <DecisionForm enrollmentId={request.id} classes={classes} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        My students ({active.length})
      </h2>
      {active.length === 0 ? (
        <Empty>No students yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              {active.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium">{item.studentName}</p>
                    <p className="text-xs text-muted-foreground">{item.studentEmail}</p>
                  </td>
                  <td>{item.courseLabel}</td>
                  <td>{item.className ?? 'One-on-one'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        My classes ({classes.length})
      </h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {classes.length === 0 ? (
            <Empty>No classes yet. Create one on the right.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Course</th><th>Schedule</th><th>State</th></tr>
                </thead>
                <tbody>
                  {classes.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>{item.courseLabel}</td>
                      <td>{item.schedule || '-'}</td>
                      <td className="capitalize">{item.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
        <Card className="h-fit p-5">
          <h3 className="text-sm font-semibold">New class</h3>
          <ClassForm courses={courseChoices} />
        </Card>
      </div>
    </PanelShell>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
