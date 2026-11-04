"use client";

import { useAsync } from "@/lib/use-async";
import {
  Card,
  Chip,
  Empty,
  Notice,
  PageHeader,
  formatDay,
} from "@/components/ui/nila";
import { api } from "@/lib/api-client";

type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  questions: unknown[];
};

/**
 * Quizzes belong to Phase 7 of the objective. The list is real data, scoped to
 * the student's active courses; taking a quiz is added with that phase.
 */
export default function StudentQuizzesPage() {
  const quizzesQuery = useAsync(
    () => api.get<QuizRow[]>("/student/quizzes"),
    [],
  );
  const quizzes = quizzesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Quizzes"
        description="Practice quizzes your teacher published for you."
      />

      <div className="mb-6">
        <Notice>
          Taking quizzes inside the app arrives with the assessment phase. This
          page lists the quizzes your teacher publishes for you.
        </Notice>
      </div>

      {quizzes.length === 0 ? (
        <Empty>No quizzes published yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{quiz.title}</p>
                <Chip tone="primary">{quiz.questions.length} questions</Chip>
              </div>
              {quiz.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {quiz.description}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Added {formatDay(quiz.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
