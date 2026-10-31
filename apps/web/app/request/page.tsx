"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { CatalogOption } from "@lms/shared";
import { PageHeader } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { api } from "@/lib/api-client";
import { useMe } from "@/lib/queries";
import { RequestForm } from "./request-form";

function Body() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  const optionsQuery = useQuery({
    queryKey: ["form-options"],
    queryFn: () =>
      api.get<{ boards: CatalogOption[]; levels: CatalogOption[]; subjects: CatalogOption[] }>(
        "/catalog/form-options",
      ),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!me.isLoading && !user) router.replace("/sign-in");
  }, [me.isLoading, user, router]);

  if (!user) return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;

  if (user.status === "active") {
    router.replace(user.home);
    return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (user.status === "rejected" && user.rejectedAt) {
    const reapplyAt = new Date(user.rejectedAt);
    reapplyAt.setDate(reapplyAt.getDate() + 30);
    if (reapplyAt > new Date()) {
      router.replace("/rejected");
      return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;
    }
  }

  const options = optionsQuery.data ?? { boards: [], levels: [], subjects: [] };

  return (
    <PanelShell
      title="Access request"
      user={{ name: user.name, role: user.role }}
    >
      <PageHeader
        title="Request access"
        description="An admin reviews every request. You will get a role only after they approve it."
      />
      <RequestForm
        defaults={{ name: user.name, email: user.email }}
        boards={options.boards}
        levels={options.levels}
        subjects={options.subjects}
      />
    </PanelShell>
  );
}

export default function RequestPage() {
  return <Body />;
}
