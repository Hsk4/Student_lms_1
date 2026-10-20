export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Attendance } from '@/models/attendance';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'teacher' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const teacher = await User.findOne({ clerkId: user.clerkId }).lean();

  const attendances = await Attendance.find({
    classId: { $exists: true },
  })
    .populate('classId', 'name')
    .sort({ date: -1 })
    .limit(10)
    .lean();

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Take and view attendance records."
      />

      {attendances.length === 0 ? (
        <Empty>No attendance records yet.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Present</th>
                <th>Absent</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((att: any) => {
                const present = att.records?.filter((r: any) => r.present).length || 0;
                const absent = att.records?.filter((r: any) => !r.present).length || 0;
                return (
                  <tr key={String(att._id)}>
                    <td>{new Date(att.date).toLocaleDateString()}</td>
                    <td>{att.classId?.name}</td>
                    <td>{present}</td>
                    <td>{absent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
