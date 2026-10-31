import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * Reference kit status map, extended with this app's own state vocabulary
 * (`suspended`, `void`, `declined`, `ended`, …) so a record row never falls
 * back to a neutral badge for a state the schema can actually produce.
 */
const STATUS_VARIANTS: Record<string, NonNullable<BadgeProps["variant"]>> = {
  active: "success",
  approved: "success",
  paid: "success",
  confirmed: "success",
  present: "success",
  published: "success",
  resolved: "success",
  done: "success",
  accepted: "success",
  current: "success",
  completed: "success",
  closed: "secondary",
  past: "secondary",
  archived: "secondary",
  draft: "secondary",
  pending: "warning",
  requested: "warning",
  sent: "warning",
  rescheduled: "warning",
  unpaid: "warning",
  escalated: "warning",
  partial: "warning",
  due: "warning",
  invited: "info",
  open: "info",
  in_progress: "info",
  processing: "info",
  overdue: "destructive",
  rejected: "destructive",
  suspended: "destructive",
  cancelled: "destructive",
  declined: "destructive",
  void: "destructive",
  revoked: "destructive",
  expired: "destructive",
  ended: "destructive",
  inactive: "secondary",
  failed: "destructive",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status.toLowerCase()] ?? "secondary";
  const text =
    label ??
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

  return (
    <Badge variant={variant} className={className}>
      {text}
    </Badge>
  );
}
