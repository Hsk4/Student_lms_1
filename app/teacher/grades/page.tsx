export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles'; 
import { Submission } from '@/models/submission';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'teacher' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const teacher = await User.findOne({ clerkId: user.clerkId }).lean();

  const submissions = await Submission.find({})
    .populate('studentId', 'name email')
    .populate('assignmentId', 'title')
    .sort({ submittedAt: -1 })
    .limit(20)
    .lean();

  const graded = submissions.filter((s: any) => s.score !== null);
  const pending = submissions.filter((s: any) => s.score === null);

  return (
    <div>
      <PageHeader
        title="Grades"
        description="Grade submissions and view student progress."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Pending ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No pending submissions.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {pending.map((sub: any) => (
            <Card key={String(sub._id)} className="p-4">
              <p className="font-medium">{sub.studentId?.name}</p>
              <p className="text-sm text-muted-foreground">{sub.assignmentId?.title}</p>
              <p className="mt-1 text-xs">Submitted {new Date(sub.submittedAt).toLocaleDateString()}</p>
              <button className="btn-primary mt-3">Grade</button>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Graded ({graded.length})
      </h2>
      {graded.length === 0 ? (
        <Empty>No graded submissions yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assignment</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {graded.map((sub: any) => (
                <tr key={String(sub._id)}>
                  <td>{sub.studentId?.name}</td>
                  <td>{sub.assignmentId?.title}</td>
                  <td className="font-mono">{sub.score}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function TeacherGradesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
