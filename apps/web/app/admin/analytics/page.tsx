"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatStrip } from "@/components/shared/stat-strip";
import { PageHeader, Card } from "@/components/ui/nila";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type Analytics = {
  users: number;
  activeUsers: number;
  pendingUsers: number;
  students: number;
  teachers: number;
};

export default function AdminAnalyticsPage() {
  const me = useAuth();
  const router = useRouter();

  // The super-admin-only screens are UX-gated here; the API enforces it.
  useEffect(() => {
    if (me.user && me.user.role !== "super_admin" && me.user.role !== "admin") {
      router.replace(me.user.home);
    }
  }, [me.user, router]);

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.get<Analytics>("/admin/analytics"),
  });
  const data = analyticsQuery.data;

  const stats = [
    { label: "Total users", value: data?.users ?? 0 },
    { label: "Active", value: data?.activeUsers ?? 0 },
    { label: "Pending approval", value: data?.pendingUsers ?? 0 },
    { label: "Students (active)", value: data?.students ?? 0 },
    { label: "Teachers (active)", value: data?.teachers ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="System-wide metrics from the database."
      />

      <StatStrip items={stats} />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Distribution by role
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-sm text-muted-foreground">
          Role breakdown chart coming soon (Charts.js or Recharts).
        </p>
      </Card>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Enrollment trends
      </h2>
      <Card className="mt-3 p-4">
        <p className="text-sm text-muted-foreground">
          Monthly enrollment and submission trends coming soon.
        </p>
      </Card>
    </div>
  );
}
