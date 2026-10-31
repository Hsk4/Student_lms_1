"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  Stat,
  formatDate,
} from "@/components/ui/nila";
type Dashboard = {
  name: string;
  students: number;
  classes: number;
  pendingRequests: number;
  ungradedSubmissions: number;
  averageScore: number | null;
};
type RequestRow = { id: string; studentName: string; courseLabel: string };
type ClassRow = {
  id: string;
  name: string;
  courseLabel: string;
  schedule: string;
  state: "current" | "past";
  studentCount: number;
};
type AssignmentRow = { id: string; title: string; classId: string | null; submissions: { score: number | null }[] };
type MeetingRow = {
  id: string;
  parentName: string;
  studentName: string;
  slots: string;
  state: string;
  confirmedAt: string | null;
};

export default function TeacherDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["teacher", "dashboard"],
    queryFn: () => api.get<Dashboard>("/teacher/dashboard"),
  });
  const requestsQuery = useQuery({
    queryKey: ["teacher", "requests"],
    queryFn: () => api.get<RequestRow[]>("/teacher/requests"),
  });
  const classesQuery = useQuery({
    queryKey: ["teacher", "classes"],
    queryFn: () => api.get<ClassRow[]>("/teacher/classes"),
  });
  const assignmentsQuery = useQuery({
    queryKey: ["teacher", "assignments"],
    queryFn: () => api.get<AssignmentRow[]>("/teacher/assignments"),
  });
  const meetingsQuery = useQuery({
    queryKey: ["teacher", "meetings"],
    queryFn: () => api.get<MeetingRow[]>("/teacher/meetings"),
  });

  const dashboard =
    dashboardQuery.data ?? {
      name: "",
      students: 0,
      classes: 0,
      pendingRequests: 0,
      ungradedSubmissions: 0,
      averageScore: null,
    };
  const requests = requestsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];

  const current = classes.filter((item) => item.state === "current");
  const upcoming = meetings
    .filter(
      (item) =>
        item.state === "requested" ||
        (item.confirmedAt !== null && new Date(item.confirmedAt) >= new Date()),
    )
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Teaching"
        description="Accept requests, run classes and give feedback."
      >
        <Link href="/teacher/assignments" className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover">
          New assignment
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Students"
          value={dashboard.students}
          hint={`${dashboard.classes} current classes`}
        />
        <Stat
          label="Requests"
          value={dashboard.pendingRequests}
          hint={
            requests.length ? "Waiting for your decision" : "Nothing waiting"
          }
        />
        <Stat
          label="Ungraded"
          value={dashboard.ungradedSubmissions}
          hint={
            dashboard.ungradedSubmissions
              ? "Submissions to grade"
              : "All graded"
          }
        />
        <Stat
          label="Average score"
          value={
            dashboard.averageScore === null ? "-" : `${dashboard.averageScore}%`
          }
          hint="Across graded submissions"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Student requests
            </h2>
            <Link
              href="/teacher/requests"
              className="text-sm font-medium text-primary hover:underline"
            >
              Review all
            </Link>
          </div>
          {requests.length === 0 ? (
            <Empty>No pending requests.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {requests.slice(0, 4).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {request.studentName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {request.courseLabel}
                    </p>
                  </div>
                  <Chip tone="amber">Requested</Chip>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Meetings
            </h2>
            <Link
              href="/teacher/meetings"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty>No meeting requests.</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {upcoming.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {meeting.parentName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      For {meeting.studentName} /{" "}
                      {meeting.confirmedAt
                        ? formatDate(meeting.confirmedAt)
                        : meeting.slots}
                    </p>
                  </div>
                  <Chip
                    tone={meeting.state === "confirmed" ? "green" : "amber"}
                  >
                    {meeting.state}
                  </Chip>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Current classes
          </h2>
          <Link
            href="/teacher/classes"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage classes
          </Link>
        </div>
        {current.length === 0 ? (
          <Empty>
            No class yet. Create one from Classes, then accept students into it.
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((klass) => (
              <Link
                key={klass.id}
                href={`/teacher/classes/detail?id=${klass.id}`}
                className="block"
              >
                <Card className="p-4 transition-colors duration-150 hover:bg-tint">
                  <p className="font-medium">{klass.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {klass.courseLabel}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {klass.schedule || "Schedule not set"} /{" "}
                    {klass.studentCount} students
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent assignments
          </h2>
          <Link
            href="/teacher/assignments"
            className="text-sm font-medium text-primary hover:underline"
          >
            All assignments
          </Link>
        </div>
        {assignments.length === 0 ? (
          <Empty>Nothing published yet.</Empty>
        ) : (
          <Card className="divide-y divide-border">
            {assignments.slice(0, 5).map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {assignment.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.classId ? "Class" : "One student"} /{" "}
                    {assignment.submissions.length} submission
                    {assignment.submissions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Chip
                  tone={
                    assignment.submissions.some((row) => row.score === null)
                      ? "amber"
                      : "neutral"
                  }
                >
                  {
                    assignment.submissions.filter((row) => row.score === null)
                      .length
                  }{" "}
                  to grade
                </Chip>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
