"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Score,
  Stat,
  formatDay,
} from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { RescheduleMeetingForm } from "../../parent-forms";
import { InlineLoading } from "@/components/shared/skeleton";

type ChildOverview = {
  id: string;
  name: string;
  boardName: string | null;
  levelName: string | null;
  teachers: {
    id: string;
    name: string;
    courseLabel: string;
    className: string | null;
  }[];
  attendanceRate: number | null;
  latestGrades: { title: string; score: number; gradedAt: string | null }[];
  dueAmount: number;
  nextMeeting: { id: string; when: string; teacherName: string } | null;
};

function DetailById() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const query = useAsync(
    () => api.get<ChildOverview>(`/parent/children/${id}`),
    [id], { enabled: Boolean(id) },
  );

  if (!id)
    return (
      <p className="p-6 text-sm text-muted-foreground">No child selected.</p>
    );
  if (query.loading)
    return <InlineLoading />;
  if (query.error)
    return <p className="p-6 text-sm text-status-red">{query.error.message}</p>;
  const child = query.data;
  if (!child) return null;

  return (
    <div>
      <PageHeader
        title={child.name}
        description={[child.boardName, child.levelName]
          .filter(Boolean)
          .join(" / ")}
      >
        <Link
          href="/parent"
          className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        >
          All children
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Attendance"
          value={
            child.attendanceRate === null ? "-" : `${child.attendanceRate}%`
          }
        />
        <Stat
          label="Unpaid fees"
          value={`PKR ${child.dueAmount.toLocaleString("en-PK")}`}
        />
        <Stat label="Teachers" value={child.teachers.length} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Teachers
        </h2>
        {child.teachers.length === 0 ? (
          <Empty>No teacher assigned yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {child.teachers.map((teacher) => (
              <Card
                key={`${teacher.id}-${teacher.courseLabel}`}
                className="p-4"
              >
                <p className="font-medium">{teacher.name}</p>
                <p className="text-sm text-muted-foreground">
                  {teacher.courseLabel}
                </p>
                <p className="mt-1 text-sm">
                  {teacher.className ?? "One-on-one"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Latest grades
          </h2>
          {child.latestGrades.length === 0 ? (
            <Empty>No graded work yet.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {child.latestGrades.map((grade, index) => (
                <div
                  key={`${grade.title}-${index}`}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {grade.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(grade.gradedAt)}
                    </p>
                  </div>
                  <Score value={grade.score} />
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Next meeting
          </h2>
          {child.nextMeeting ? (
            <Card className="p-4">
              <p className="text-sm">With {child.nextMeeting.teacherName}</p>
              <p className="mt-1 font-medium">
                {child.nextMeeting.when.includes("T")
                  ? formatDay(child.nextMeeting.when)
                  : child.nextMeeting.when}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Chip tone="amber">
                  {child.nextMeeting.when.includes("T")
                    ? "Confirmed"
                    : "Requested"}
                </Chip>
                <RescheduleMeetingForm meetingId={child.nextMeeting.id} />
              </div>
            </Card>
          ) : (
            <Empty>
              No meeting scheduled. Request one from the Meetings page.
            </Empty>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        This view is read-only. Contact the school office for corrections.
      </p>
    </div>
  );
}

export default function ParentChildPage() {
  return (
    <Suspense
      fallback={<InlineLoading />}
    >
      <DetailById />
    </Suspense>
  );
}