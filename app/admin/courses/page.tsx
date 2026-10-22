export const instant = false;

import Link from "next/link";
import { getCatalogLists, listCourses, type CourseRow as CourseRowData } from "@/lib/queries/admin";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { CourseForm, CourseRow } from "./course-ui";
import { LevelForm, LevelRow } from "./level-ui";
import { SubjectForm, SubjectRow } from "./subject-ui";

const TABS = [
  { key: "courses", label: "Courses" },
  { key: "levels", label: "Levels" },
  { key: "subjects", label: "Subjects" },
] as const;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; board?: string; level?: string }>;
}) {
  const { tab = "courses", board, level } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? tab : "courses";
  const { boards, levels, subjects } = await getCatalogLists();
  const courses = await listCourses();

  const filtered = courses
    .filter((c) => (board ? c.boardId === board : true))
    .filter((c) => (level ? c.levelId === level : true))
    .sort(
      (a, b) =>
        a.levelOrder - b.levelOrder || a.subject.localeCompare(b.subject),
    );

  return (
    <>
      <PageHeader
        title="Courses"
        description="A course is one board, one level and one subject, with an optional medium."
      >
        <Link href="/admin/books" className="btn-secondary">
          Recommended books
        </Link>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/courses?tab=${item.key}`}
            className={`tab ${activeTab === item.key ? "tab-active" : ""}`}
          >
            {item.label}
            <span className="ms-2 text-xs text-muted-foreground">
              {item.key === "courses"
                ? courses.length
                : item.key === "levels"
                  ? levels.length
                  : subjects.length}
            </span>
          </Link>
        ))}
      </div>

      {activeTab === "courses" ? (
        <CoursesTab
          boards={boards}
          levels={levels}
          subjects={subjects}
          courses={filtered}
          selectedBoard={board}
          selectedLevel={level}
        />
      ) : null}

      {activeTab === "levels" ? <LevelsTab levels={levels} /> : null}
      {activeTab === "subjects" ? <SubjectsTab subjects={subjects} /> : null}
    </>
  );
}

function Filters({
  boards,
  levels,
  board,
  level,
}: {
  boards: { id: string; name: string }[];
  levels: { id: string; name: string }[];
  board?: string;
  level?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tab" value="courses" />
      <div>
        <label className="label" htmlFor="filter-board">
          Board
        </label>
        <select
          id="filter-board"
          name="board"
          defaultValue={board ?? ""}
          className="input w-48"
        >
          <option value="">All boards</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="filter-level">
          Level
        </label>
        <select
          id="filter-level"
          name="level"
          defaultValue={level ?? ""}
          className="input w-44"
        >
          <option value="">All levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-secondary">
        Apply
      </button>
      <Link href="/admin/courses" className="btn-ghost">
        Reset
      </Link>
    </form>
  );
}

function CoursesTab({
  boards,
  levels,
  subjects,
  courses,
  selectedBoard,
  selectedLevel,
}: {
  boards: { id: string; name: string; active: boolean }[];
  levels: { id: string; name: string; active: boolean }[];
  subjects: { id: string; name: string; active: boolean }[];
    courses: CourseRowData[];
    selectedBoard?: string;
    selectedLevel?: string;
  }) {
    return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Filters
          boards={boards}
          levels={levels}
          board={selectedBoard}
          level={selectedLevel}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {courses.length === 0 ? (
            <Empty>
              No courses yet. Create a board, a level and a subject first, then
              add the course.
            </Empty>
          ) : (
            <Card className="overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Board</th>
                    <th>Books</th>
                    <th>State</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-foreground">New course</h2>
          {boards.length === 0 ||
          levels.length === 0 ||
          subjects.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Add at least one board, one level and one subject before creating
              a course.
            </p>
          ) : (
            <CourseForm boards={boards} levels={levels} subjects={subjects} />
          )}
        </Card>
      </div>

      {courses.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {courses.length} course{courses.length === 1 ? "" : "s"} shown.{" "}
          <Link
            href={`/admin/courses/${courses[0].id}`}
            className="text-primary"
          >
            Open the newest course
          </Link>{" "}
          to attach materials and see its recommended books.
        </p>
      ) : null}
    </div>
  );
}

function LevelsTab({
  levels,
}: {
  levels: { id: string; name: string; order: number; active: boolean }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {levels.length === 0 ? (
          <Empty>No levels yet.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Level</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {levels.map((item) => (
                  <LevelRow key={item.id} level={item} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      <Card className="h-fit p-5">
        <h2 className="text-sm font-semibold text-foreground">New level</h2>
        <LevelForm />
      </Card>
    </div>
  );
}

function SubjectsTab({
  subjects,
}: {
  subjects: { id: string; name: string; slug: string; active: boolean }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {subjects.length === 0 ? (
          <Empty>No subjects yet.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Slug</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subjects.map((item) => (
                  <SubjectRow key={item.id} subject={item} />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      <Card className="h-fit p-5">
        <h2 className="text-sm font-semibold text-foreground">New subject</h2>
        <SubjectForm />
      </Card>
    </div>
  );
}
