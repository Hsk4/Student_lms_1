"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Chip, Empty, Notice, PageHeader } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { RequestTeacherForm } from "../student-forms";

type MatchingTeacher = { id: string; name: string; courses: { id: string; label: string }[] };
type StudentProfile = { boardName: string | null; levelName: string | null };
type CourseRow = { courseId: string; state: string };

export default function StudentTeachersPage() {
  const profileQuery = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () => api.get<StudentProfile>("/student/profile"),
  });
  const coursesQuery = useQuery({
    queryKey: ["student", "courses"],
    queryFn: () => api.get<CourseRow[]>("/student/courses"),
  });
  // The API scopes this to the signed-in student's board and level.
  const matchingQuery = useQuery({
    queryKey: ["student", "teachers"],
    queryFn: () => api.get<MatchingTeacher[]>("/student/teachers"),
  });

  const profile = profileQuery.data ?? { boardName: null, levelName: null };
  const courses = coursesQuery.data ?? [];
  const matching = matchingQuery.data ?? [];

  const activeIds = new Set(
    courses.filter((course) => course.state === "active").map((course) => course.courseId),
  );
  const hasOpenRequest = courses.some(
    (course) => course.state === "requested" || course.state === "active",
  );

  const teacherList = matching;

  return (
    <div>
      <PageHeader
        title="Find a teacher"
        description={`Teachers of ${profile.boardName ?? "your board"} / ${profile.levelName ?? "your level"} courses.`}
      />

      {hasOpenRequest ? (
        <div className="mb-6">
          <Notice>
            You already have an open request or an active enrollment. Cancel it
            with the school office before asking another teacher.
          </Notice>
        </div>
      ) : null}

      {matching.length === 0 ? (
        <Empty>
          No teacher currently teaches a course matching your board and level.
          The school office adds teachers as courses open.
        </Empty>
      ) : (
        <div className="space-y-4">
          {teacherList.map((teacher) => (
            <Card key={teacher.id} className="p-5">
              <p className="font-semibold text-foreground">{teacher.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Teaches {teacher.courses.length} matching course
                {teacher.courses.length === 1 ? "" : "s"}
              </p>
              <div className="mt-4 space-y-2">
                {teacher.courses.map((course: MatchingTeacher["courses"][number]) => (
                  <div
                    key={course.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3"
                  >
                    <span className="text-sm font-medium">{course.label}</span>
                    {activeIds.has(course.id) ? (
                      <Chip tone="green">Enrolled</Chip>
                    ) : (
                      <RequestTeacherForm
                        teacherId={teacher.id}
                        courseId={course.id}
                        disabled={hasOpenRequest}
                        disabledReason="Finish your open request first"
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
