export const instant = false;

import { Card, Empty, PageHeader } from "@/components/ui/nila";
import { listClasses, listMyCourseChoices } from "@/actions/teacher-panel";
import { ClassForm, EndClassButton } from "../teacher-forms";

export default async function TeacherClassesPage() {
  const [classes, courses] = await Promise.all([
    listClasses(),
    listMyCourseChoices(),
  ]);
  const current = classes.filter((item) => item.state === "current");
  const past = classes.filter((item) => item.state === "past");

  return (
    <div>
      <PageHeader
        title="Classes"
        description="A class groups students of one course. Students accepted without a class are one-on-one."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Current ({current.length})
            </h2>
            {current.length === 0 ? (
              <Empty>No current class. Create one on the right.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {current.map((klass) => (
                  <Card key={klass.id} className="p-4">
                    <a
                      href={`/teacher/classes/${klass.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {klass.name}
                    </a>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {klass.courseLabel}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {klass.schedule || "Schedule not set"} /{" "}
                      {klass.studentCount} student
                      {klass.studentCount === 1 ? "" : "s"}
                    </p>
                    <div className="mt-3">
                      <EndClassButton classId={klass.id} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Past ({past.length})
            </h2>
            {past.length === 0 ? (
              <Empty>No past classes.</Empty>
            ) : (
              <Card className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((klass) => (
                      <tr key={klass.id}>
                        <td className="font-medium">{klass.name}</td>
                        <td>{klass.courseLabel}</td>
                        <td className="tabular-nums">{klass.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">New class</h2>
          <ClassForm courses={courses} />
        </Card>
      </div>
    </div>
  );
}
