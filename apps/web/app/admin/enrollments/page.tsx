"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { ReassignForm } from "./reassign-form";

type EnrollmentRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseLabel: string;
  teacherId: string;
  teacherName: string;
  className: string | null;
  state: string;
  teachers: { id: string; name: string }[];
};

export default function AdminEnrollmentsPage() {
  const enrollmentsQuery = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: () => api.get<EnrollmentRow[]>("/admin/enrollments"),
  });
  const items = enrollmentsQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Enrollments"
        description="Reassign a student to another teacher. The old enrollment is cancelled and the new one created in one transaction."
      />
      {items.length === 0 ? (
        <Empty>No open enrollments.</Empty>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.studentEmail}
                  </p>
                </div>
                <span className="chip border-border text-muted-foreground">
                  {item.state}
                </span>
              </div>
              <p className="mt-2 text-sm">{item.courseLabel}</p>
              <p className="text-sm text-muted-foreground">
                Teacher: {item.teacherName} / {item.className ?? "one-on-one"}
              </p>
              <div className="mt-3">
                <ReassignForm
                  enrollmentId={item.id}
                  currentTeacherId={item.teacherId}
                  teachers={item.teachers}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
