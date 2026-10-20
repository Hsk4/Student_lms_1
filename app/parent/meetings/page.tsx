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
  if (user.role !== 'parent' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const parent = await User.findOne({ clerkId: user.clerkId }).lean();

  const meetings = await Meeting.find({ parentId: parent?._id })
    .populate('teacherId', 'name email')
    .populate('studentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Request and view meetings with teachers."
      />

      {meetings.length === 0 ? (
        <Empty>No meeting requests yet.</Empty>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting: any) => (
            <Card key={String(meeting._id)} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{meeting.teacherId?.name}</p>
                  <p className="text-sm text-muted-foreground">{meeting.studentId?.name}</p>
                  {meeting.confirmedAt && (
                    <p className="mt-1 text-sm">
                      Confirmed: {new Date(meeting.confirmedAt).toLocaleString('en-PK', {
                        timeZone: 'Asia/Karachi',
                      })}
                    </p>
                  )}
                </div>
                <span className={`status-${
                  meeting.state === 'confirmed' ? 'green' :
                  meeting.state === 'cancelled' ? 'red' :
                  'amber'
                }`}>
                  {meeting.state}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentMeetingsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
