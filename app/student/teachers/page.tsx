export const instant = false;

import { Card, Chip, Empty, Notice, PageHeader } from "@/components/ui/nila";
import { listMyCourses, getMyProfile } from "@/actions/student-panel";
import { listMatchingTeachers, type MatchingTeacher } from "@/lib/queries/teaching";
import { RequestTeacherForm } from "../student-forms";

export default async function StudentTeachersPage() {
  const [profile, courses] = await Promise.all([getMyProfile(), listMyCourses()]);

  // Row guard: only teachers of this student's board and level are listed.
  const matching = await listMatchingTeachers(profile.id);

  const activeIds = new Set(
    courses.filter((course) => course.state === "active").map((course) => course.courseId),
  );
  const hasOpenRequest = courses.some(
    (course) => course.state === "requested" || course.state === "active",
  );

  // Server data crosses the RSC boundary as plain JSON; this shape is explicit.
  const teacherList = matching as MatchingTeacher[];

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
