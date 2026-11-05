"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/lib/auth-context";
import { webHomeFor } from "@/lib/role-home";
import { usePolling } from "@/lib/queries";

const STEPS = ["Account created", "Request under review", "Access granted"];

export default function PendingPage() {
  return <PendingBody />;
}

/**
 * The role picked on a sign-up door, forwarded as `?next=`. Only the three
 * application routes are honoured: this is a convenience, never a redirect to
 * anywhere a URL could name.
 */
function nextStepTarget(raw: string | null): string | null {
  if (!raw) return null;
  return raw === "/request?role=teacher" ||
    raw === "/request?role=parent" ||
    raw === "/request?role=student"
    ? raw
    : null;
}

function PendingBody() {
  const { user, signedIn, loading: meLoading } = useAuth();
  const router = useRouter();

  // Polls every 5 seconds while this page is open: it moves on by itself once
  // an admin decides. The API is what decides; this is a redirect.
  const statusQuery = usePolling<RequestStatusResponse>(
    () => api.get<RequestStatusResponse>("/me/request"),
    [],
    signedIn && Boolean(user),
  );
  const status = statusQuery.data;

  // The provider has settled with no session (or it was rejected): waiting on
  // the loading flag alone would leave a signed-out visitor on the spinner.
  /*
   * `signedIn` is a hint from `localStorage`; `user` is the account the API
   * confirmed. Until one of them proves there *is* a session, the page must not
   * jump to sign-in — arriving with a token that is still being verified used
   * to bounce straight back out.
   */
  const decided = !meLoading && (Boolean(user) || !signedIn);
  const signedOut = decided && !user;
  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
  }, [signedOut, router]);

  useEffect(() => {
    // A role is the approval: a pending account that already has one (the
    // seeded super admin) belongs in its panel, not on this page.
    if (user && (user.status !== "pending" || user.role))
      router.replace(webHomeFor(user.home));
  }, [user, router]);

  const isParentRequest = status?.requestedRole === "parent";
  const isTeacherRequest = status?.requestedRole === "teacher";
  /*
   * The door the applicant chose before signing up, forwarded as `?next=`.
   *
   * Read from `window.location` rather than `useSearchParams`: `/pending` is
   * the page the app was already on before it moved here, so Next re-renders
   * that instance and its search params would still be the first render's.
   */
  const nextStep = nextStepTarget(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("next"),
  );
  // A door chosen at sign-up wins over a stale one from an earlier request.
  const isParentFlow = nextStep === "/request?role=parent" || isParentRequest;
  /*
   * An account that already carries a role was seeded or assigned by an admin,
   * not created through a request form — so `hasOpenRequest` is legitimately
   * false for it. Offering that account "fill in the request form" is wrong
   * (and it is what a freshly seeded super admin was being shown). It needs
   * activation, not an application.
   */
  const assignedRole = Boolean(user?.role);
  const needsRequest = !assignedRole && !status?.hasOpenRequest;
  /*
   * No automatic forward from here.
   *
   * The chosen door (`?next=`) is used for the wording and to preselect the
   * right button below; the applicant clicks it. An automatic replace raced the
   * status poll and could bounce an account between two pages, which is exactly
   * how "I chose parent" turned into "nothing happened".
   */
  /*
   * The tracker names the role the applicant asked for. Everyone used to see
   * "Request under review", which read like the same generic form for a parent
   * and a teacher even though the applications are now different.
   */
  const steps = isParentFlow
    ? ["Account created", "Parent access under review", "Enter your child's code"]
    : isTeacherRequest
      ? ["Account created", "Teacher application under review", "Classes open"]
      : nextStep === "/request?role=teacher"
        ? ["Account created", "Teacher application under review", "Classes open"]
        : STEPS;

  // Nothing until a pending account is loaded; the effect redirects anyone
  // else, and showing the tracker first would be wrong for them.
  if (!decided || !user || user.status !== "pending" || user.role)
    return <PanelLoading />;

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
            {isParentFlow
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
                      ? "Signed in."
                      : index === 1
                        ? assignedRole
                          ? `Your ${user.role?.replace("_", " ")} role is assigned. Waiting for activation.`
                          : status?.hasOpenRequest
                            ? "Submitted. Nothing else to do here."
                            : isParentFlow
                              ? "Send it from the parent page."
                              : isTeacherRequest || nextStep === "/request?role=teacher"
                                ? "Submit your teaching application first."
                                : "Submit the access request first."
                        : isParentFlow
                          ? "After approval, enter the code your child gave you."
                          : isTeacherRequest || nextStep === "/request?role=teacher"
                            ? "Your subjects and classes open once approved."
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
              {nextStep
                ? "One step left: your application."
                : "You have not sent an access request yet."}
            </Notice>
            <div className="flex flex-wrap gap-2">
              {/* The door chosen at sign-up is the primary action. */}
              <Button asChild size="xl">
                <Link href={nextStep ?? "/request?role=teacher"}>
                  {nextStep === "/request?role=parent"
                    ? "Request parent access"
                    : nextStep === "/request?role=student"
                      ? "Request student access"
                      : "Apply as a teacher"}
                </Link>
              </Button>
              {nextStep !== "/request?role=teacher" ? (
                <Button asChild size="lg" variant="outline">
                  <Link href="/request?role=teacher">Apply as a teacher</Link>
                </Button>
              ) : null}
              {nextStep !== "/request?role=parent" ? (
                <Button asChild size="lg" variant="outline">
                  <Link href="/request?role=parent">Request parent access</Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="outline">
                <Link href="/request?role=student">I am a student</Link>
              </Button>
            </div>
          </div>
        ) : assignedRole && !isParentFlow ? (
          <div className="mt-6">
            <Notice tone="info">
              An administrator has to activate this account. Nothing else is
              needed from you; this page updates on its own.
            </Notice>
          </div>
        ) : null}

        {status?.hasOpenRequest && isParentFlow ? (
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
