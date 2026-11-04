"use client";

// Temporary visual check of the pending page in both themes. Deleted after use.
import { useEffect } from "react";
import Link from "next/link";

import { ArchNumber } from "@/components/brand/primitives";
import { HourglassIllustration } from "@/components/brand/illustrations";
import { ThemeToggle } from "@/components/shell/page-actions";
import { GateShell } from "@/components/shell/shell";
import { Card, Notice } from "@/components/ui/nila";

const STEPS = [
  { n: 1, title: "Account created", detail: "Signed in with Clerk.", state: "done" },
  {
    n: 2,
    title: "Request under review",
    detail: "Your super admin role is assigned. Waiting for activation.",
    state: "now",
  },
  { n: 3, title: "Access granted", detail: "You will be sent to your panel.", state: "next" },
];

export default function PendingHarness() {
  useEffect(() => {
    localStorage.setItem("lms-theme", "light");
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <GateShell title="Waiting for approval" user={{ name: "Hammad", role: "super_admin" }}>
      <section className="mb-6 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
        <HourglassIllustration size={110} className="shrink-0" />
        <div className="mt-3 sm:mt-0 sm:ml-6">
          <p className="fastly-eyebrow text-cobalt">Request received</p>
          <h1 className="fastly-display mt-2 text-[26px] text-foreground sm:text-[30px]">
            Your account is pending
          </h1>
          <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            An admin has to approve you before you can use the school. This page
            updates on its own.
          </p>
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-start gap-3">
              <ArchNumber
                n={s.n}
                size={32}
                tone={s.state === "done" ? "navy" : s.state === "now" ? "cobalt" : "outline"}
              />
              <div className="min-w-0">
                <p
                  className={
                    s.state === "next"
                      ? "text-sm font-medium text-muted-foreground"
                      : "text-sm font-semibold text-foreground"
                  }
                >
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {s.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <Notice tone="info">
            An administrator has to activate this account. Nothing else is needed
            from you; this page updates on its own.
          </Notice>
        </div>
      </Card>
    </GateShell>
  );
}
