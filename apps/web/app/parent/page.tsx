"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  Chip,
  PageHeader,
  Notice,
  Score,
  Stat,
  formatDate,
} from "@/components/ui/nila";
import { RequestMeetingForm } from "./parent-forms";

type ChildOverview = {
  id: string;
  name: string;
  email: string;
  boardName: string | null;
  levelName: string | null;
  teachers: { id: string; name: string; courseLabel: string; className: string | null }[];
  attendanceRate: number | null;
  latestGrades: { title: string; score: number; gradedAt: string | null }[];
  dueAmount: number;
  nextMeeting: { id: string; when: string; teacherName: string } | null;
};

export default function ParentDashboardPage() {
  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => api.get<ChildOverview[]>("/parent/overview"),
  });
  const children = childrenQuery.data ?? [];

  const totalDue = children.reduce((sum, child) => sum + child.dueAmount, 0);
  const rates = children
    .map((child) => child.attendanceRate)
    .filter((rate): rate is number => rate !== null);
  const averageAttendance = rates.length
    ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
    : null;

  return (
    <div>
      <PageHeader
        title="My children"
        description="A read-only view of each child's teacher, progress, attendance and fees."
      >
        <Button asChild size="xl">
          <Link href="/parent/meetings">Request a meeting</Link>
        </Button>
      </PageHeader>

      {children.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No child linked yet"
          description="Ask your child to open “Parent access” in their panel and give you the eight-character code, then link it here."
          action={
            <Button asChild size="xl">
              <Link href="/parent/link">Link a child</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Children" value={children.length} />
            <Stat
              label="Average attendance"
              value={averageAttendance === null ? "-" : `${averageAttendance}%`}
            />
            <Stat
              label="Outstanding fees"
              value={`PKR ${totalDue.toLocaleString("en-PK")}`}
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="flex h-full flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="fastly-display text-[22px] text-foreground">
                      {child.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {[child.boardName, child.levelName]
                        .filter(Boolean)
                        .join(" / ") || "Board not set"}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/parent/children/detail?id=${child.id}`}>
                      Open
                    </Link>
                  </Button>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Teacher</dt>
                    <dd>
                      {child.teachers.length
                        ? child.teachers
                            .map((teacher) => teacher.name)
                            .join(", ")
                        : "Not assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Class</dt>
                    <dd>
                      {child.teachers.length
                        ? child.teachers
                            .map((teacher) => teacher.className ?? "One-on-one")
                            .join(", ")
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Attendance
                    </dt>
                    <dd className="tabular-nums">
                      {child.attendanceRate === null
                        ? "No records"
                        : `${child.attendanceRate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fees</dt>
                    <dd className="tabular-nums">
                      {child.dueAmount === 0
                        ? "Nothing due"
                        : `PKR ${child.dueAmount.toLocaleString("en-PK")} due`}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <p className="fastly-eyebrow text-cobalt">Latest grades</p>
                  {child.latestGrades.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No graded work yet.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {child.latestGrades.slice(0, 3).map((grade, index) => (
                        <li
                          key={`${grade.title}-${index}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">{grade.title}</span>
                          <Score value={grade.score} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  {child.nextMeeting ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        Meeting with {child.nextMeeting.teacherName}:{" "}
                        <span className="font-medium">
                          {child.nextMeeting.when.includes("T")
                            ? formatDate(child.nextMeeting.when)
                            : child.nextMeeting.when}
                        </span>
                      </p>
                      <Chip tone="amber">
                        {child.nextMeeting.when.includes("T")
                          ? "Scheduled"
                          : "Requested"}
                      </Chip>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No meeting scheduled.
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 p-5">
            <SectionHeader title="Request a meeting with a teacher" />
            <div className="max-w-md">
              <RequestMeetingForm
                childRows={children.map(({ id, name }) => ({ id, name }))}
              />
            </div>
          </Card>

          {children.some((child) => child.teachers.length === 0) ? (
            <div className="mt-6">
              <Notice>
                A child without a teacher is waiting for the office to assign
                one. The child picks the teacher from their own panel.
              </Notice>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
