"use client";

import Link from "next/link";
import { useAsync } from "@/lib/use-async";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { api } from "@/lib/api-client";
import { ArchTile } from "@/components/brand/primitives";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  Chip,
  PageHeader,
  Score,
  Stat,
  formatDate,
  formatDay,
  toneFor,
} from "@/components/ui/nila";
type Profile = {
  activeCourseCount: number;
  teachers: { name: string; courseLabel: string; className: string | null }[];
};
type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  submissionId: string | null;
  score: number | null;
};
type AttendanceRow = { id: string; date: string; present: boolean; context: string };
type GradeRow = { id: string; title: string; courseLabel: string; score: number; gradedAt: string | null };

export default function StudentDashboardPage() {
  const profileQuery = useAsync(
    () => api.get<Profile>("/student/profile"),
    [],
  );
  const assignmentsQuery = useAsync(
    () => api.get<AssignmentRow[]>("/student/assignments"),
    [],
  );
  const attendanceQuery = useAsync(
    () => api.get<AttendanceRow[]>("/student/attendance"),
    [],
  );
  const gradesQuery = useAsync(
    () => api.get<GradeRow[]>("/student/grades"),
    [],
  );

  const profile = profileQuery.data ?? { activeCourseCount: 0, teachers: [] };
  const assignments = assignmentsQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];
  const grades = gradesQuery.data ?? [];

  const open = assignments.filter((item) => !item.submissionId);
  const present = attendance.filter((item) => item.present).length;
  const attendanceRate = attendance.length
    ? Math.round((present / attendance.length) * 100)
    : null;
  const averageScore = grades.length
    ? Math.round(
        grades.reduce((sum, item) => sum + item.score, 0) / grades.length,
      )
    : null;

  return (
    <div>
      <PageHeader
        title="My learning"
        description="Your teachers, work in progress and latest results."
      >
        {/* The one primary action on this page. `Button` owns the height and
            padding; a bare class list gave this link no padding at all. */}
        <Button asChild size="xl">
          <Link href="/student/teachers">Find a teacher</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active courses" value={profile.activeCourseCount} />
        <Stat
          label="Open work"
          value={open.length}
          hint={
            open.length ? "Assignments not submitted yet" : "Nothing pending"
          }
        />
        <Stat
          label="Average score"
          value={averageScore === null ? "-" : `${averageScore}%`}
          hint={`${grades.length} graded`}
        />
        <Stat
          label="Attendance"
          value={attendanceRate === null ? "-" : `${attendanceRate}%`}
          hint={`${attendance.length} classes recorded`}
        />
      </div>

      <section className="mt-8">
        <SectionHeader title="My teachers" />
        {profile.teachers.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No teacher yet"
            description="Choose the teacher you want to study with. They confirm you before your courses open."
            action={
              <Button asChild size="xl">
                <Link href="/student/teachers">Pick a teacher</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.teachers.map((teacher, index) => (
              <Card key={`${teacher.name}-${index}`} className="flex items-center gap-3 p-4">
                <ArchTile size={44} tone="tint">
                  <GraduationCap size={20} strokeWidth={1.7} />
                </ArchTile>
                <div className="min-w-0">
                  <p className="fastly-display truncate text-[17px] text-foreground">
                    {teacher.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {teacher.courseLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {teacher.className ?? "One-on-one"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Assignments"
          action={{ href: "/student/assignments", label: "View all" }}
        />
        {assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No assignments yet"
            description="When a teacher sets work it appears here with its due date and your mark."
          />
        ) : (
          <div className="space-y-3">
            {assignments.slice(0, 5).map((assignment) => (
              <Card key={assignment.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {assignment.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {formatDate(assignment.dueAt)}
                    </p>
                  </div>
                  {assignment.submissionId ? (
                    assignment.score === null ? (
                      <Chip tone="amber">Awaiting grade</Chip>
                    ) : (
                      <Score value={assignment.score} />
                    )
                  ) : (
                    <Chip tone="primary">To do</Chip>
                  )}
                </div>
                {assignment.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {assignment.description}
                  </p>
                ) : null}
                {assignment.submissionId ? null : (
                  <Link
                    href="/student/assignments"
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Submit work
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Recent grades" />
          {grades.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No grades yet"
              description="Marks appear here once a teacher grades your submitted work."
            />
          ) : (
            <Card className="divide-y divide-border">
              {grades.slice(0, 5).map((grade) => (
                <div
                  key={grade.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {grade.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {grade.courseLabel} / {formatDay(grade.gradedAt)}
                    </p>
                  </div>
                  <Score value={grade.score} />
                </div>
              ))}
            </Card>
          )}
        </div>
        <div>
          <SectionHeader title="Recent attendance" />
          {attendance.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No attendance recorded"
              description="Your attendance for each class shows up here after the teacher marks the register."
            />
          ) : (
            <Card className="divide-y divide-border">
              {attendance.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.context}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(entry.date)}
                    </p>
                  </div>
                  <Chip
                    tone={entry.present ? toneFor("present") : toneFor("past")}
                  >
                    {entry.present ? "Present" : "Absent"}
                  </Chip>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
