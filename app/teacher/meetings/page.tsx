export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Meeting } from '@/models/meeting';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'teacher' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const teacher = await User.findOne({ clerkId: user.clerkId }).lean();

  const meetings = await Meeting.find({ teacherId: teacher?._id })
    .populate('parentId', 'name email')
    .populate('studentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const pending = meetings.filter((m: any) => m.state === 'requested');
  const confirmed = meetings.filter((m: any) => m.state === 'confirmed');

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Confirm parent meeting requests."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Pending ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No pending requests.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {pending.map((meeting: any) => (
            <Card key={String(meeting._id)} className="p-4">
              <p className="font-medium">{meeting.parentId?.name}</p>
              <p className="text-sm text-muted-foreground">For {meeting.studentId?.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Requested slots: {meeting.requestedSlots?.join(', ') || 'None specified'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Confirm by setting a time.</p>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Confirmed ({confirmed.length})
      </h2>
      {confirmed.length === 0 ? (
        <Empty>No confirmed meetings yet.</Empty>
      ) : (
        <div className="space-y-3">
          {confirmed.map((meeting: any) => (
            <Card key={String(meeting._id)} className="p-4">
              <p className="font-medium">{meeting.parentId?.name}</p>
              <p className="text-sm text-muted-foreground">For {meeting.studentId?.name}</p>
              <p className="mt-2 text-sm">
                Confirmed:{' '}
                {new Date(meeting.confirmedAt).toLocaleString('en-PK', {
                  timeZone: 'Asia/Karachi',
                })}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherMeetingsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
