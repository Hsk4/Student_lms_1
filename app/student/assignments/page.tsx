export const instant = false;

import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  formatDate,
} from "@/components/ui/nila";
import { listMyAssignments } from "@/actions/student-panel";
import { SubmitAssignmentForm } from "../student-forms";

export default async function StudentAssignmentsPage() {
  const assignments = await listMyAssignments();

  const toDo = assignments.filter((item) => !item.submissionId);
  const submitted = assignments.filter(
    (item) => item.submissionId && item.score === null,
  );
  const graded = assignments.filter((item) => item.score !== null);

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Work set by your teachers, what is due and your results."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            To do
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {toDo.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Awaiting grade
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {submitted.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Graded
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {graded.length}
          </p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        All assignments
      </h2>
      {assignments.length === 0 ? (
        <Empty>
          No assignments yet. They appear once your teacher publishes work.
        </Empty>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const overdue =
              !assignment.submissionId &&
              assignment.dueAt !== null &&
              new Date(assignment.dueAt) < new Date();

            return (
              <Card key={assignment.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {assignment.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignment.dueAt
                        ? `Due ${formatDate(assignment.dueAt)}`
                        : "No due date"}
                    </p>
                  </div>
                  {assignment.submissionId ? (
                    assignment.score === null ? (
                      <Chip tone="amber">Awaiting grade</Chip>
                    ) : (
                      <Score value={assignment.score} />
                    )
                  ) : overdue ? (
                    <Chip tone="red">Overdue</Chip>
                  ) : (
                    <Chip tone="primary">To do</Chip>
                  )}
                </div>

                {assignment.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {assignment.description}
                  </p>
                ) : null}

                {assignment.submissionId ? (
                  assignment.score !== null ? (
                    <p className="mt-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-sm">
                      <span className="font-medium">Feedback: </span>
                      {assignment.feedback || "No feedback left."}
                    </p>
                  ) : null
                ) : (
                  <div className="mt-3">
                    <SubmitAssignmentForm assignmentId={assignment.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
