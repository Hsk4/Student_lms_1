export const instant = false;

import Link from "next/link";
import { Fragment } from "react";
import { getTeacherCourseAssignments, listUsers } from "@/lib/queries/admin";
import { TeacherCoursesForm } from "./teacher-courses";
import {
  PageHeader,
  Card,
  Empty,
  RoleChip,
  StatusChip,
  formatDay,
} from "@/components/ui/nila";

const STATUSES = ["", "pending", "active", "rejected", "suspended"];
const ROLES = ["", "super_admin", "admin", "teacher", "student", "parent"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; role?: string; q?: string }>;
}) {
  const { status, role, q } = await searchParams;
  const [users, teacherAssignments] = await Promise.all([
    listUsers({ status, role, q }),
    getTeacherCourseAssignments(),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Suspend, reinstate or open an account."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="input w-56"
            placeholder="Name or email"
          />
        </div>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="input w-40"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value || "Any"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={role ?? ""}
            className="input w-44"
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {value ? value.replace("_", " ") : "Any"}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      {users.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Board / level</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                <tr>
                  <td>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </td>
                  <td>
                    <RoleChip role={user.role} />
                  </td>
                  <td>
                    <StatusChip status={user.status} />
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {[user.board, user.level].filter(Boolean).join(" / ") || "-"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {formatDay(user.createdAt)}
                  </td>
                  <td className="text-end">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="btn-ghost h-8"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
                {user.role === "teacher" ? (
                  <tr>
                    <td colSpan={6} className="bg-surface">
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-primary">
                          Edit teachable courses for {user.name}
                        </summary>
                        <div className="mt-3 max-w-xl">
                          <TeacherCoursesForm
                            teacherId={user.id}
                            courses={teacherAssignments.map((course) => ({
                              id: course.id,
                              label: course.label,
                              selected: course.teacherIds.includes(user.id),
                            }))}
                          />
                        </div>
                      </details>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
