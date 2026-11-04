"use client";

import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import { api } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableView } from "@/components/shared/data-table-view";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { Pagination } from "@/components/shared/pagination";
import { StatStrip } from "@/components/shared/stat-strip";

import { TeacherCoursesForm } from "./teacher-courses";

import { UsersAutoRefresh } from "./auto-refresh";
import {
  PageHeader,
  RoleChip,
  StatusChip,
  formatDay,
} from "@/components/ui/nila";

const STATUSES = ["", "pending", "active", "rejected", "suspended"];
const ROLES = ["", "super_admin", "admin", "teacher", "student", "parent"];
const PAGE_SIZE = 25;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: string;
  onboarded: boolean;
  createdAt: string;
  board?: string;
  level?: string;
  rejectionReason?: string;
};

type UsersResponse = {
  total: number;
  page: number;
  pageCount: number;
  counts: { all: number; active: number; pending: number; teachers: number };
  users: UserRow[];
};

type TeacherCourseRow = { id: string; label: string; teacherIds: string[] };

/**
 * The list is paged by the API from Postgres; `q`, `status`, `role` and `page`
 * live in the URL so the back button and bookmarks keep working.
 */
export default function AdminUsersPage() {
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const role = params.get("role") ?? "";
  const q = params.get("q") ?? "";
  const rawPage = params.get("page") ?? "1";

  const usersQuery = useAsync(
    () => api.get<UsersResponse>("/admin/users", {
        status,
        role,
        q,
        page: rawPage,
        pageSize: PAGE_SIZE,
      }),
    [status, role, q, rawPage],
  );
  const teacherCoursesQuery = useAsync(
    () => api.get<TeacherCourseRow[]>("/admin/catalog/teacher-courses"),
    [],
  );

  const counts = usersQuery.data?.counts ?? { all: 0, active: 0, pending: 0, teachers: 0 };
  const total = usersQuery.data?.total ?? 0;
  const page = usersQuery.data?.page ?? 1;
  const pageCount = usersQuery.data?.pageCount ?? 1;
  const users = usersQuery.data?.users ?? [];
  const teacherAssignments = teacherCoursesQuery.data ?? [];

  return (
    <>
      <UsersAutoRefresh onRefresh={usersQuery.reload} />
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Users"
          description="Suspend, reinstate or open an account."
        />

        <StatStrip
          items={[
            { label: "Users", value: counts.all },
            { label: "Active", value: counts.active },
            {
              label: "Awaiting approval",
              value: counts.pending,
              hint: counts.pending ? "Review on Requests" : "Queue clear",
            },
            { label: "Teachers", value: counts.teachers },
          ]}
        />

        <DataTableView
          toolbar={
            <ListToolbar
              action="/admin/users"
              searchPlaceholder="Search name or email"
              searchValue={q ?? ""}
              filters={[
                {
                  id: "status",
                  label: "Status",
                  value: status ?? "",
                  options: STATUSES.map((value) => ({
                    value,
                    label: value || "Any status",
                  })),
                },
                {
                  id: "role",
                  label: "Role",
                  value: role ?? "",
                  options: ROLES.map((value) => ({
                    value,
                    label: value ? value.replace("_", " ") : "Any role",
                  })),
                },
              ]}
            />
          }
          footer={
            <Pagination
              basePath="/admin/users"
              page={page}
              pageCount={pageCount}
              totalItems={total}
              pageSize={PAGE_SIZE}
              searchParams={{
                status,
                role,
                q,
                page: page > 1 ? String(page) : undefined,
                // Distinct from the current page so paging keeps the filters.
                // (Pagination writes `page` itself.)
              }}
            />
          }
          empty={users.length === 0}
          emptyTitle="No users match"
          emptyDescription="Try a different search or clear the filters."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Board / level</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <Fragment key={user.id}>
                <TableRow>
                  <TableCell>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <RoleChip role={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={user.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[user.board, user.level].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDay(user.createdAt)}
                  </TableCell>
                  <TableCell className="w-px whitespace-nowrap text-end">
                    {/* Icon button, like the reference kit's row actions: the
                        row already says who this is, so a label repeated five
                        times only adds noise. `aria-label` carries the name. */}
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <Link
                        href={`/admin/users/detail?id=${user.id}`}
                        aria-label={`Open ${user.name}`}
                        title={`Open ${user.name}`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
                {user.role === "teacher" ? (
                  <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                    <TableCell colSpan={6} className="py-2">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                          Teachable courses for {user.name}
                        </summary>
                        <div className="mt-3 max-w-xl pl-6">
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
                    </TableCell>
                  </TableRow>
                ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </DataTableView>
      </div>
    </>
  );
}
