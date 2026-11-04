"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { RequestStatusResponse } from "@lms/shared";
import {
  Card,
  Notice,
} from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { HourglassIllustration } from "@/components/brand/illustrations";
import { Button } from "@/components/ui/button";
import { PanelShell } from "@/components/shell/shell";
import { PanelLoading } from "@/lib/guards";
import { api } from "@/lib/api-client";
import { useMe } from "@/lib/queries";

const STEPS = ["Account created", "Request under review", "Access granted"];

export default function PendingPage() {
  const me = useMe();
  const router = useRouter();
  const user = me.data;

  // Called on mount and every 5 seconds: the page moves on by itself once an
  // admin decides. The API is what decides; this is a redirect.
  const statusQuery = useQuery({
    queryKey: ["me", "request"],
    queryFn: () => api.get<RequestStatusResponse>("/me/request"),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });
  const status = statusQuery.data;

  // `isLoading === false` with no data is a 401 (signed out or suspended):
  // waiting on `isLoading` alone leaves a signed-out visitor on the spinner.
  const signedOut = me.isFetched && !user;
  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
  }, [signedOut, router]);

  useEffect(() => {
    // A role is the approval: a pending account that already has one (the
    // seeded super admin) belongs in its panel, not on this page.
    if (user && (user.status !== "pending" || user.role))
      router.replace(user.home);
  }, [user, router]);

  const isParentRequest = status?.requestedRole === "parent";
  /*
   * An account that already carries a role was seeded or assigned by an admin,
   * not created through a request form — so `hasOpenRequest` is legitimately
   * false for it. Offering that account "fill in the request form" is wrong
   * (and it is what a freshly seeded super admin was being shown). It needs
   * activation, not an application.
   */
  const assignedRole = Boolean(user?.role);
  const needsRequest = !assignedRole && !status?.hasOpenRequest;
  const steps = isParentRequest
    ? [
        "Account created",
        "Parent access under review",
        "Enter your child's code",
      ]
    : STEPS;

  // Nothing until a pending account is loaded; the effect redirects anyone
  // else, and showing the tracker first would be wrong for them.
  if (!user || user.status !== "pending" || user.role) return <PanelLoading />;

  return (
    <PanelShell
      title="Waiting for approval"
      user={{ name: user.name, role: user.role }}
    >
      <section className="mb-6 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
        <HourglassIllustration size={120} className="shrink-0" />
        <div className="mt-3 sm:mt-0 sm:ml-6">
          <p className="fastly-eyebrow text-cobalt">Request received</p>
          <h1 className="fastly-display mt-2 text-[26px] text-foreground sm:text-[30px]">
            Your account is pending
          </h1>
          <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {isParentRequest
              ? "The school office reviews parent accounts before activation. This page updates on its own."
              : "An admin has to approve you before you can use the school. This page updates on its own."}
          </p>
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <ol className="space-y-4">
          {steps.map((step, index) => {
            const done =
              index === 0
                ? true
                : index === 1
                  ? Boolean(status?.hasOpenRequest)
                  : false;
            const current = !done && index === 1;
            return (
              <li key={step} className="flex items-start gap-3">
                <ArchNumber
                  n={index + 1}
                  size={32}
                  tone={done ? "navy" : current ? "cobalt" : "outline"}
                />
                <div className="min-w-0">
                  <p
                    className={
                      done || current
                        ? "text-sm font-semibold text-foreground"
                        : "text-sm font-medium text-muted-foreground"
                    }
                  >
                    {step}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {index === 0
                      ? "Signed in with Clerk."
                      : index === 1
                        ? assignedRole
                          ? `Your ${user.role?.replace("_", " ")} role is assigned. Waiting for activation.`
                          : status?.hasOpenRequest
                            ? "Submitted. Nothing else to do here."
                            : isParentRequest
                              ? "Send it from the parent page."
                              : "Submit the access request first."
                        : isParentRequest
                          ? "After approval, enter the code your child gave you."
                          : "You will be sent to your panel."}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {needsRequest ? (
          <div className="mt-6 space-y-3">
            <Notice tone="info">
              You have not sent an access request yet.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="xl">
                <Link href="/request">Fill in the request form</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sign-up/parent">I am a parent</Link>
              </Button>
            </div>
          </div>
        ) : assignedRole && !isParentRequest ? (
          <div className="mt-6">
            <Notice tone="info">
              An administrator has to activate this account. Nothing else is
              needed from you; this page updates on its own.
            </Notice>
          </div>
        ) : null}

        {status?.hasOpenRequest && isParentRequest ? (
          <p className="mt-6 text-xs text-muted-foreground">
            Once approved you come back here and open{" "}
            <strong>Link a child</strong> to enter the code. Approval alone does
            not link anyone.
          </p>
        ) : null}
      </Card>
    </PanelShell>
  );
}
