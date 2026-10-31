"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { RequestStatusResponse } from "@lms/shared";
import { PageHeader, Card, Notice } from "@/components/ui/nila";
import { PanelShell } from "@/components/shell/shell";
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

  useEffect(() => {
    if (!me.isLoading && !user) router.replace("/sign-in");
  }, [me.isLoading, user, router]);

  useEffect(() => {
    if (user && user.status !== "pending") router.replace(user.home);
  }, [user, router]);

  const isParentRequest = status?.requestedRole === "parent";
  const steps = isParentRequest
    ? [
        "Account created",
        "Parent access under review",
        "Enter your child's code",
      ]
    : STEPS;

  return (
    <PanelShell
      title="Waiting for approval"
      user={{ name: user?.name ?? "", role: user?.role ?? null }}
    >
      <PageHeader
        title="Your account is pending"
        description={
          isParentRequest
            ? "The school office reviews parent accounts before activation. This page updates on its own."
            : "An admin has to approve you before you can use the school. This page updates on its own."
        }
      />

      <Card className="p-6">
        <ol className="space-y-4">
          {steps.map((step, index) => {
            const done =
              index === 0
                ? true
                : index === 1
                  ? Boolean(status?.hasOpenRequest)
                  : false;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step}</p>
                  <p className="text-xs text-muted-foreground">
                    {index === 0
                      ? "Signed in with Clerk."
                      : index === 1
                        ? status?.hasOpenRequest
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

        {!status?.hasOpenRequest ? (
          <div className="mt-6 space-y-3">
            <Notice tone="info">
              You have not sent an access request yet.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/request"
                className="bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover"
              >
                Fill in the request form
              </Link>
              <Link
                href="/sign-up/parent"
                className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
              >
                I am a parent
              </Link>
            </div>
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
