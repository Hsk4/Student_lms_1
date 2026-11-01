import type { NavIconName } from "@/components/shell/nav-icons";

/**
 * Navigation is plain data: the sidebar, the mobile sheet, the topbar title and
 * the active-item lookup all read the same array, so a new page is one entry.
 *
 * Badges are *not* declared here — they come from the layout (a live count of
 * pending requests), because the config is shared by client components.
 */
export type NavBadgeKey = "pending" | "requests" | "grading" | "meetings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  description: string;
  /** The exact href that counts as active. Defaults to `href`. */
  match?: string;
  superAdminOnly?: boolean;
  badgeKey?: NavBadgeKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/* -------------------------------------------------------------------------
 * Admin
 * ---------------------------------------------------------------------- */

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: "Approval",
    items: [
      {
        // `/admin` redirects here, so the route highlights as "Overview".
        href: "/admin/requests",
        label: "Overview",
        icon: "Inbox",
        description: "Access requests and today's queue",
        match: "/admin",
      },
      {
        href: "/admin/users",
        label: "Users",
        icon: "Users",
        description: "Students, teachers and parents",
      },
      {
        href: "/admin/parent-invites",
        label: "Parent invites",
        icon: "UserPlus",
        description: "Guardian link codes",
      },
      {
        href: "/admin/audit-log",
        label: "Audit log",
        icon: "ScrollText",
        description: "Activity trail",
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        href: "/admin/boards",
        label: "Boards",
        icon: "ClipboardList",
        description: "Academic boards",
      },
      {
        href: "/admin/courses",
        label: "Courses",
        icon: "FileText",
        description: "Levels, subjects and courses",
      },
      {
        href: "/admin/books",
        label: "Books",
        icon: "BookOpen",
        description: "Library inventory",
      },
    ],
  },
  {
    title: "Teaching",
    items: [
      {
        href: "/admin/enrollments",
        label: "Enrollments",
        icon: "GraduationCap",
        description: "Class assignments",
      },
      {
        href: "/admin/invoices",
        label: "Invoices",
        icon: "Banknote",
        description: "Tuition fees",
      },
      {
        href: "/admin/support",
        label: "Support",
        icon: "Ticket",
        description: "Support tickets",
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: "BarChart3",
        description: "School performance",
      },
    ],
  },
];

export const ADMIN_SUPER_NAV: NavItem = {
  href: "/admin/admins",
  label: "Admins",
  icon: "ShieldCheck",
  superAdminOnly: true,
  description: "Administrator accounts",
};

/** The groups for one admin, with the super-admin block only when it applies. */
export function adminNavGroups(isSuperAdmin: boolean): NavGroup[] {
  return isSuperAdmin
    ? [...ADMIN_NAV_GROUPS, { title: "Super admin", items: [ADMIN_SUPER_NAV] }]
    : ADMIN_NAV_GROUPS;
}

/* -------------------------------------------------------------------------
 * Student
 * ---------------------------------------------------------------------- */

export const STUDENT_NAV_GROUPS: NavGroup[] = [
  {
    title: "Learning",
    items: [
      {
        href: "/student",
        label: "Dashboard",
        icon: "GraduationCap",
        description: "Your day at a glance",
        match: "/student",
      },
      {
        href: "/student/courses",
        label: "My courses",
        icon: "BookOpen",
        description: "Enrolled courses",
      },
      {
        href: "/student/teachers",
        label: "Teachers",
        icon: "UsersRound",
        description: "Your teachers",
      },
      {
        href: "/student/assignments",
        label: "Assignments",
        icon: "ClipboardCheck",
        description: "Homework and submissions",
      },
      {
        href: "/student/attendance",
        label: "Attendance",
        icon: "CalendarDays",
        description: "Class attendance record",
      },
      {
        href: "/student/materials",
        label: "Materials",
        icon: "FileText",
        description: "Notes and past papers",
      },
      {
        href: "/student/quizzes",
        label: "Quizzes",
        icon: "FileQuestion",
        description: "Practice quizzes",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/student/invoices",
        label: "Invoices",
        icon: "Coins",
        description: "Fee invoices",
      },
      {
        href: "/student/books",
        label: "Books",
        icon: "BookMarked",
        description: "Recommended books",
      },
      {
        href: "/student/guardians",
        label: "Parent access",
        icon: "UserPlus",
        description: "Guardian link codes",
      },
      {
        href: "/student/support",
        label: "Support",
        icon: "LifeBuoy",
        description: "Ask for help",
      },
    ],
  },
];

/* -------------------------------------------------------------------------
 * Teacher
 * ---------------------------------------------------------------------- */

export const TEACHER_NAV_GROUPS: NavGroup[] = [
  {
    title: "Teaching",
    items: [
      {
        href: "/teacher",
        label: "Dashboard",
        icon: "GraduationCap",
        description: "Your teaching day",
        match: "/teacher",
      },
      {
        href: "/teacher/requests",
        label: "Requests",
        icon: "Inbox",
        description: "Enrollment requests",
        badgeKey: "requests",
      },
      {
        href: "/teacher/students",
        label: "Students",
        icon: "Users",
        description: "Students you teach",
      },
      {
        href: "/teacher/classes",
        label: "Classes",
        icon: "BookOpen",
        description: "Current and past classes",
      },
      {
        href: "/teacher/assignments",
        label: "Assignments",
        icon: "ClipboardCheck",
        description: "Set work and grading",
        badgeKey: "grading",
      },
      {
        href: "/teacher/attendance",
        label: "Attendance",
        icon: "CalendarDays",
        description: "Mark attendance",
      },
    ],
  },
  {
    title: "Engagement",
    items: [
      {
        href: "/teacher/meetings",
        label: "Meetings",
        icon: "CalendarRange",
        description: "Parent meetings",
        badgeKey: "meetings",
      },
      {
        href: "/teacher/support",
        label: "Support",
        icon: "LifeBuoy",
        description: "Support tickets",
      },
    ],
  },
];

/* -------------------------------------------------------------------------
 * Parent
 * ---------------------------------------------------------------------- */

export const PARENT_NAV_GROUPS: NavGroup[] = [
  {
    title: "Family",
    items: [
      {
        href: "/parent",
        label: "Children",
        icon: "Users",
        description: "Follow your children",
        match: "/parent",
      },
      {
        href: "/parent/link",
        label: "Link a child",
        icon: "Link2",
        description: "Redeem a guardian code",
      },
      {
        href: "/parent/invoices",
        label: "Invoices",
        icon: "Coins",
        description: "Fees and payments",
      },
      {
        href: "/parent/meetings",
        label: "Meetings",
        icon: "CalendarRange",
        description: "Teacher meetings",
      },
    ],
  },
];

export const PANEL_NAV: Record<
  "admin" | "student" | "teacher" | "parent",
  NavGroup[]
> = {
  admin: ADMIN_NAV_GROUPS,
  student: STUDENT_NAV_GROUPS,
  teacher: TEACHER_NAV_GROUPS,
  parent: PARENT_NAV_GROUPS,
};

/** True when `pathname` belongs to `item`. */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const base = item.match ?? item.href;
  if (pathname === base) return true;
  // The dashboard entry (`/student`) must not light up on every child route.
  if (item.match) return false;
  return pathname.startsWith(`${item.href}/`);
}

/** The nav item that owns `pathname`, for the topbar title. Longest href wins. */
export function findNavItem(
  pathname: string,
  groups: NavGroup[],
): NavItem | undefined {
  return groups
    .flatMap((group) => group.items)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export const PANEL_LABEL: Record<
  "admin" | "student" | "teacher" | "parent",
  { name: string; subtitle: string }
> = {
  admin: { name: "Fastly LMS", subtitle: "Admin console" },
  student: { name: "Fastly LMS", subtitle: "Student panel" },
  teacher: { name: "Fastly LMS", subtitle: "Teacher panel" },
  parent: { name: "Fastly LMS", subtitle: "Parent panel" },
};
