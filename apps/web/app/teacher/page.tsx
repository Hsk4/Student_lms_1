"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, Inbox, Plus, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import {
  Card,
  Chip,
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
        <Button asChild size="xl">
          <Link href="/teacher/assignments">
            <Plus />
            New assignment
          </Link>
        </Button>
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
          <SectionHeader
            title="Student requests"
            action={{ href: "/teacher/requests", label: "Review all" }}
          />
          {requests.length === 0 ? (
            <EmptyState
              size="inline"
              icon={Inbox}
              title="No requests waiting"
              description="When a student asks to join your class, it arrives here for you to accept."
            />
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
          <SectionHeader
            title="Meetings"
            action={{ href: "/teacher/meetings", label: "Open" }}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              size="inline"
              icon={CalendarCheck}
              title="No meeting requests"
              description="Parents can ask to meet you; requests and confirmed slots appear here."
            />
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
        <SectionHeader
          title="Current classes"
          action={{ href: "/teacher/classes", label: "Manage classes" }}
        />
        {current.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No class yet"
            description="Create a class from Classes, then accept students into it."
            action={
              <Button asChild size="xl">
                <Link href="/teacher/classes">Create a class</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((klass) => (
              <Link
                key={klass.id}
                href={`/teacher/classes/detail?id=${klass.id}`}
                className="block"
              >
                <Card className="h-full p-4 transition-colors duration-150 hover:bg-tint">
                  <p className="fastly-display text-[17px] text-foreground">
                    {klass.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {klass.courseLabel}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
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
        <SectionHeader
          title="Recent assignments"
          action={{ href: "/teacher/assignments", label: "All assignments" }}
        />
        {assignments.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Nothing published yet"
            description="Set your first piece of work and it will appear here with its grading status."
            action={
              <Button asChild size="xl">
                <Link href="/teacher/assignments">Set an assignment</Link>
              </Button>
            }
          />
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
