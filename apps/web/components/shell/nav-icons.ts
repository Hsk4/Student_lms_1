import {
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileQuestion,
  FileText,
  GraduationCap,
  Inbox,
  LifeBuoy,
  Link2,
  ScrollText,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon registry.
 *
 * A server layout cannot hand a component (a function) to a client component —
 * React only allows plain data across that boundary. Nav items therefore carry
 * an icon *name*, and the client sidebar looks it up here. Keeping the map in
 * one place also means the bundle contains only icons that are actually used.
 */
export const NAV_ICONS = {
  Banknote,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileQuestion,
  FileText,
  GraduationCap,
  Inbox,
  LifeBuoy,
  Link2,
  ScrollText,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  UsersRound,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export function navIcon(name: NavIconName): LucideIcon {
  return NAV_ICONS[name] ?? FileText;
}
