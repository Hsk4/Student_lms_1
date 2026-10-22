"use client";

import { useState } from "react";
import { setTeacherCourses } from "@/actions/teacher";
import { ActionForm } from "@/components/ui/action-form";

export type TeacherCourse = { id: string; label: string; selected: boolean };

export function TeacherCoursesForm({
  teacherId,
  courses,
}: {
  teacherId: string;
  courses: TeacherCourse[];
}) {
  const [selected, setSelected] = useState(
    courses.filter((course) => course.selected).map((course) => course.id),
  );

  return (
    <ActionForm
      className="space-y-3"
      submitLabel="Save courses"
      resetOnSuccess={false}
      action={async () => setTeacherCourses({ teacherId, courseIds: selected })}
    >
      <div className="space-y-2">
        {courses.map((course) => (
          <label key={course.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(course.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, course.id]
                    : current.filter((id) => id !== course.id),
                )
              }
            />
            {course.label}
          </label>
        ))}
      </div>
    </ActionForm>
  );
}
