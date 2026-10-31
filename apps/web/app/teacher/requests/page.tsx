export const instant = false;

import { Card, Empty, PageHeader, formatDay } from "@/components/ui/nila";
import { listClasses, listStudentRequests } from "@/actions/teacher-panel";
import { DecisionForm } from "../teacher-forms";

export default async function TeacherRequestsPage() {
  const [requests, classes] = await Promise.all([
    listStudentRequests(),
    listClasses(),
  ]);
  const openClasses = classes.filter((klass) => klass.state === "current");

  return (
    <div>
      <PageHeader
        title="Student requests"
        description="Accept a student into a class or as one-on-one, or decline."
      />

      {requests.length === 0 ? (
        <Empty>No pending requests.</Empty>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{request.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.studentEmail}
                  </p>
                  <p className="mt-1 text-sm">{request.courseLabel}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requested {formatDay(request.requestedAt)}
                </p>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <DecisionForm
                  enrollmentId={request.id}
                  classes={openClasses.filter(
                    (klass) => klass.courseId === request.courseId,
                  )}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
