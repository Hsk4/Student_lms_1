export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Book } from '@/models/book';
import { Course } from '@/models/course';
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
    .populate('courseId')
    .lean();

  const courseIds = enrollments.map((e: any) => e.courseId._id);

  const books = await Book.find({ courseIds: { $in: courseIds } })
    .sort({ title: 1 })
    .lean();

  return (
    <div>
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
    </div>
  );
}

export default function StudentBooksPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
