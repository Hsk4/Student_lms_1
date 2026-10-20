export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { Shell, type SidebarGroup } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { Material } from '@/models/material';
import { Enrollment } from '@/models/enrollment';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');
  if (!user.onboarded) redirect('/onboarding/parent');

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
    </Shell>
  );
}

export default function StudentMaterialsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
