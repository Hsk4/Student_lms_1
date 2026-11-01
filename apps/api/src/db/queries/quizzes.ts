import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { quizzes } from "@/db/schema";
import type { Id, Quiz, QuizState } from "@/db/types";

/**
 * Quizzes. Postgres-backed.
 *
 * `questions` is `jsonb` typed as `Question[]` — authored and rendered as a
 * whole, never queried inside. The column's `.$type<Question[]>()` means the
 * driver round-trips the array intact, so no parsing lives here.
 */

type QuizRow = typeof quizzes.$inferSelect;

export function toQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    courseId: row.courseId,
    studentId: row.studentId,
    title: row.title,
    description: row.description,
    questions: row.questions ?? [],
    generatedBy: row.generatedBy,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Quizzes a student may take: theirs, on courses they are active in, published. */
export async function listPublishedQuizzesForStudent(
  studentId: Id,
  courseIds: Id[],
  conn: Tx | typeof db = db,
): Promise<Quiz[]> {
  if (courseIds.length === 0) return [];
  const rows = await conn
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.studentId, studentId),
        inArray(quizzes.courseId, courseIds),
        eq(quizzes.state, "published"),
      ),
    )
    .orderBy(desc(quizzes.createdAt));
  return rows.map(toQuiz);
}

export async function listQuizzesForCourse(
  courseId: Id,
  conn: Tx | typeof db = db,
): Promise<Quiz[]> {
  const rows = await conn
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .orderBy(desc(quizzes.createdAt));
  return rows.map(toQuiz);
}

export async function findQuizById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Quiz | null> {
  const [row] = await conn
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  return row ? toQuiz(row) : null;
}

export async function setQuizState(
  id: Id,
  state: QuizState,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(quizzes).set({ state }).where(eq(quizzes.id, id));
}
