export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Material } from '@/models/material';
import { Enrollment } from '@/models/enrollment';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const student = await User.findOne({ clerkId: user.clerkId }).lean();

  const enrollments = await Enrollment.find({
    studentId: student?._id,
    state: 'active',
  })
    .populate('courseId', 'name')
    .lean();

  const courseIds = enrollments.map((e: any) => e.courseId._id);

  const materials = await Material.find({ courseId: { $in: courseIds } })
    .populate('courseId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const byType = {
    notes: materials.filter((m: any) => m.type === 'notes'),
    past_paper: materials.filter((m: any) => m.type === 'past_paper'),
    worksheet: materials.filter((m: any) => m.type === 'worksheet'),
  };

  return (
    <div>
      <PageHeader
        title="Course materials"
        description="Download notes, past papers and worksheets."
      />

      {['notes', 'past_paper', 'worksheet'].map((type) => (
        <div key={type}>
          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {type === 'past_paper'
              ? 'Past Papers'
              : type.charAt(0).toUpperCase() + type.slice(1)}
          </h2>

          {byType[type as keyof typeof byType].length === 0 ? (
            <p className="text-sm text-muted-foreground mb-6">None available yet.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {byType[type as keyof typeof byType].map((mat: any) => (
                <Card key={String(mat._id)} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{mat.title}</p>
                    <p className="text-xs text-muted-foreground">{mat.courseId?.name}</p>
                  </div>
                  <a href={mat.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                    Download
                  </a>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StudentMaterialsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
