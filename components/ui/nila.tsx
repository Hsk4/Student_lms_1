import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-status-green bg-status-green-soft text-status-green",
  pending: "border-status-amber bg-status-amber-soft text-status-amber",
  rejected: "border-status-red bg-status-red-soft text-status-red",
  suspended: "border-status-red bg-status-red-soft text-status-red",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`chip ${STATUS_STYLES[status] ?? "border-border text-muted-foreground"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

const ROLE_STYLES: Record<string, string> = {
  super_admin: "border-navy bg-navy text-navy-foreground",
  admin: "border-primary bg-primary text-primary-foreground",
  teacher: "border-tint bg-tint text-tint-foreground",
  student: "border-primary bg-background text-primary",
  parent: "border-dashed border-primary bg-background text-primary",
};

export function RoleChip({ role }: { role: string | null }) {
  if (!role) {
    return (
      <span className="chip border-border text-muted-foreground">no role</span>
    );
  }
  return (
    <span
      className={`chip ${ROLE_STYLES[role] ?? "border-border text-muted-foreground"}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-status-red bg-status-red-soft text-status-red"
      : tone === "success"
        ? "border-status-green bg-status-green-soft text-status-green"
        : "border-border bg-tint text-tint-foreground";

  return (
    <p
      className={`rounded-[var(--radius-card)] border px-3 py-2 text-sm ${styles}`}
      role="status"
    >
      {children}
    </p>
  );
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDay(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
  });
}

const CHIP_TONES: Record<string, string> = {
  green: "border-status-green bg-status-green-soft text-status-green",
  amber: "border-status-amber bg-status-amber-soft text-status-amber",
  red: "border-status-red bg-status-red-soft text-status-red",
  neutral: "border-border bg-surface text-muted-foreground",
  primary: "border-primary bg-tint text-tint-foreground",
};

export type ChipTone = keyof typeof CHIP_TONES;

/** A small status pill with the Nila status colours. */
export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: ChipTone;
  children: ReactNode;
}) {
  return <span className={`chip ${CHIP_TONES[tone] ?? CHIP_TONES.neutral}`}>{children}</span>;
}

/** Maps a domain state string to a chip tone. */
export function toneFor(state: string): ChipTone {
  switch (state) {
    case "active":
    case "paid":
    case "confirmed":
    case "present":
    case "current":
    case "accepted":
    case "done":
    case "resolved":
      return "green";
    case "requested":
    case "pending":
    case "sent":
    case "rescheduled":
    case "unpaid":
    case "escalated":
      return "amber";
    case "declined":
    case "cancelled":
    case "revoked":
    case "suspended":
    case "rejected":
    case "void":
    case "expired":
    case "past":
    case "ended":
      return "red";
    default:
      return "neutral";
  }
}

/** One label/value pair in a summary card. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

const SCORE_TONE = (score: number) =>
  score >= 70 ? "green" : score >= 40 ? "amber" : "red";

/** A score out of 100 with a traffic-light tone. */
export function Score({ value }: { value: number }) {
  return (
    <span className={`chip tabular-nums ${CHIP_TONES[SCORE_TONE(value)]}`}>
      {value}/100
    </span>
  );
}
