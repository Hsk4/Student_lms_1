export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { Shell, type SidebarGroup } from '@/components/shell/shell';
import { getCurrentUser } from '@/lib/auth/roles';
import { Book } from '@/models/book';
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
    .populate('courseId')
    .lean();

  const courseIds = enrollments.map((e: any) => e.courseId._id);

  const books = await Book.find({ courseIds: { $in: courseIds } })
    .sort({ title: 1 })
    .lean();

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
        title="Recommended books"
        description="Recommended courseware for your courses."
      />

      {books.length === 0 ? (
        <Empty>No recommended books yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {books.map((book: any) => (
            <Card key={String(book._id)} className="p-4">
              <p className="font-semibold">{book.title}</p>
              <p className="text-sm text-muted-foreground">{book.author}</p>
              {book.note && (
                <p className="mt-2 text-sm">{book.note}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

export default function StudentBooksPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
