"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import type { CatalogOption } from "@lms/shared";
import { PageHeader } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
import { ArchNumber } from "@/components/brand/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { webHomeFor } from "@/lib/role-home";
import { RequestForm } from "./request-form";
import { InlineLoading } from "@/components/shared/skeleton";

function Body() {
  const me = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const user = me.user;

  // `/request?role=parent` opens straight onto the parent application; the
  // parent sign-up page links here. Anything else starts on teacher.
  const initialRole = search.get("role") === "parent" ? "parent" : "teacher";

  const optionsQuery = useAsync(
    () =>
      api.get<{
        boards: CatalogOption[];
        levels: CatalogOption[];
        subjects: CatalogOption[];
      }>("/catalog/form-options"),
    [],
    { enabled: Boolean(user) },
  );

  // `isFetched && !user` is the 401 case (signed out or suspended).
  useEffect(() => {
    if (me.settled && !user) router.replace("/sign-in");
  }, [me.settled, user, router]);

  useEffect(() => {
    if (user && user.status === "active") router.replace(webHomeFor(user.home));
  }, [user, router]);

  /*
   * Any account that already has a role belongs in its own panel, whether or
   * not it is `active`: a seeded super admin is pending-with-a-role, and the
   * old `status === "active"` check left it stranded on this form. `home`
   * already encodes the rule (see `homeFor`), so follow it rather than
   * re-deriving it here.
   */
  useEffect(() => {
    if (user?.role && user.home !== "/request") {
      router.replace(webHomeFor(user.home));
    }
  }, [user, router]);

  if (!user) return <InlineLoading />;

  if (user.role && user.home !== "/request") {
    return <InlineLoading />;
  }

  if (user.status === "rejected" && user.rejectedAt) {
    const reapplyAt = new Date(user.rejectedAt);
    reapplyAt.setDate(reapplyAt.getDate() + 30);
    if (reapplyAt > new Date()) {
      router.replace("/rejected");
      return <InlineLoading />;
    }
  }

  const options = optionsQuery.data ?? { boards: [], levels: [], subjects: [] };

  return (
    <PanelShell
      title="Access request"
      user={{ name: user.name, role: user.role }}
    >
      {/*
       * A single-column form, so it is centred and capped rather than stretched
       * across the full panel width — at 7xl the fields sat against the left
       * edge with a wide empty gutter beside them.
       */}
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader
          title="Request access"
          description="Choose the role you are applying for. An admin reviews every application before a role is granted."
        />
        <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
          <ArchNumber n={1} size={24} tone="cobalt" />
          Application
        </p>
        <RequestForm
          key={initialRole}
          defaults={{
            name: user.name,
            email: user.email,
            requestedRole: initialRole,
          }}
          levels={options.levels}
          subjects={options.subjects}
        />
      </div>
    </PanelShell>
  );
}

export default function RequestPage() {
  // `useSearchParams` needs a Suspense boundary in the static (mobile) export.
  return (
    <Suspense fallback={<InlineLoading />}>
      <Body />
    </Suspense>
  );
}
