"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { CatalogOption } from "@lms/shared";
import { PageHeader } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { ArchNumber } from "@/components/brand/primitives";
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

  // `isFetched && !user` is the 401 case (signed out or suspended).
  useEffect(() => {
    if (me.isFetched && !user) router.replace("/sign-in");
  }, [me.isFetched, user, router]);

  useEffect(() => {
    if (user && user.status === "active") router.replace(user.home);
  }, [user, router]);

  if (!user) return <div className="p-10 text-sm text-muted-foreground">Loading...</div>;

  if (user.status === "active") {
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
      <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
        <ArchNumber n={1} size={24} tone="cobalt" />
        Your details
      </p>
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
