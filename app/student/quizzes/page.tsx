export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { requireSignedIn } from '@/lib/auth/roles';
import { Quiz } from '@/models/quiz';
import { Enrollment } from '@/models/enrollment';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';

async function Body() {
  const user = await requireSignedIn();
  if (user.role !== 'student' || user.status !== 'active') redirect('/pending');

  await connectDB();

  const student = await User.findOne({ clerkId: user.clerkId }).lean();

  // Get enrolled courses
  const enrollments = await Enrollment.find({
    studentId: student?._id,
    state: 'active',
  })
    .populate('courseId', 'name')
    .lean();

  const courseIds = enrollments.map((e: any) => e.courseId._id);

  // Get quizzes for enrolled courses
  const quizzes = await Quiz.find({
    courseId: { $in: courseIds },
    studentId: student?._id,
    state: 'published',
  })
    .populate('courseId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <PageHeader
        title="Quizzes"
        description="Take quizzes for your enrolled courses."
      />

      {quizzes.length === 0 ? (
        <Empty>No quizzes available yet. Check back soon.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz: any) => (
            <Card key={String(quiz._id)} className="p-4">
              <h3 className="font-semibold">{quiz.title}</h3>
              <p className="text-sm text-muted-foreground">{quiz.courseId?.name}</p>
              {quiz.description && (
                <p className="mt-2 text-sm">{quiz.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {quiz.questions?.length || 0} questions
              </p>
              <button className="btn-primary mt-3">Take quiz</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentQuizzesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
