export const instant = false;

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { getCurrentUser } from "@/lib/auth/roles";
import { listEnrollments } from "@/lib/queries/enrollment";
import { listMatchingTeachers } from "@/lib/queries/teaching";
import { ReassignForm } from "./reassign-form";

async function Body() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "admin" && user.role !== "super_admin")
    redirect("/pending");

  const enrollments = await listEnrollments();
  const open = enrollments.filter(
    (item) => item.state === "requested" || item.state === "active",
  );
  const teacherOptions = await Promise.all(
    open.map(async (item) => ({
      enrollmentId: item.id,
      teachers: await listMatchingTeachers(item.studentId),
    })),
  );

  return (
    <>
      <PageHeader
        title="Enrollments"
        description="Reassign a student to another teacher. The old enrollment is cancelled and the new one created in one transaction."
      />
      {open.length === 0 ? (
        <Empty>No open enrollments.</Empty>
      ) : (
        <div className="space-y-3">
          {open.map((item) => {
            const options =
              teacherOptions.find((entry) => entry.enrollmentId === item.id)
                ?.teachers ?? [];
            return (
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
                    teachers={options.map((teacher) => ({
                      id: teacher.id,
                      name: teacher.name,
                    }))}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AdminEnrollmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Body />
    </Suspense>
  );
}
