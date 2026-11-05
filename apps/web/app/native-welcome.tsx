"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, GraduationCap, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  ArchTile,
  BrandMark,
  type ArchTone,
} from "@/components/brand/primitives";
import { SCHOOL_NAME } from "@/lib/school";

/**
 * The Capacitor entry screen: "Welcome. Who are you?".
 *
 * This is the only part of the landing route that needs the browser, so it is
 * the only part that is a client component. The marketing page around it is
 * rendered on the server (see `page.tsx`), which is what gives crawlers real
 * HTML.
 *
 * `isNativePlatform` only exists once the native bridge has injected
 * `window.Capacitor`, which happens *after* hydration — so the platform is read
 * through `useSyncExternalStore` (server and first client paint both say
 * "browser") instead of during render, which would mismatch the prerendered
 * HTML.
 */

const ROLES: {
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: ArchTone;
  href: string;
}[] = [
  {
    label: "I'm a student",
    hint: "Homework, courses and results",
    icon: GraduationCap,
    tone: "cobalt",
    href: "/sign-up",
  },
  {
    label: "I'm a parent",
    hint: "Link to your child with a code",
    icon: Users,
    tone: "tint",
    href: "/sign-up/parent",
  },
  {
    label: "I'm a teacher",
    hint: "Classes, attendance and marks",
    icon: BookOpen,
    tone: "navy",
    href: "/sign-up",
  },
];

function subscribeToPlatform(onChange: () => void) {
  // The bridge appears after hydration; re-read once the page has settled.
  const timer = window.setTimeout(onChange, 0);
  return () => window.clearTimeout(timer);
}

function readIsNative() {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  return typeof capacitor?.isNativePlatform === "function"
    ? capacitor.isNativePlatform()
    : false;
}

export function NativeWelcome() {
  const isNative = useSyncExternalStore(
    subscribeToPlatform,
    readIsNative,
    () => false,
  );
  // Remember the choice so the welcome does not push the landing beneath it.
  const [answered, setAnswered] = useState(false);

  // In a browser this renders nothing: the server already sent the landing
  // page, and swapping it for a second copy would be a hydration mismatch.
  if (!isNative || answered) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-background">
      {/* Top band: navy with the arch mark, as on the splash screen. */}
      <div className="fastly-gate-band relative flex h-56 shrink-0 items-center justify-center">
        <span className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-3 px-6 text-center">
          <BrandMark size={64} tone="light" />
          <p className="fastly-display text-[20px] text-white">{SCHOOL_NAME}</p>
        </div>
      </div>

      <div className="fastly-sheet relative -mt-7 flex flex-1 flex-col border-[1.5px] border-line bg-card px-6 pt-8">
        <h1 className="fastly-display text-[28px] leading-tight text-foreground">
          Welcome. Who are you?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pick the door that fits. The school office confirms it before anything
          opens.
        </p>

        <ul className="mt-6 space-y-3">
          {ROLES.map((role) => (
            <li key={role.label}>
              <Link
                href={role.href}
                onClick={() => setAnswered(true)}
                className="flex min-h-16 w-full items-center gap-3.5 rounded-xl border-[1.5px] border-line px-3.5 py-2.5 text-left transition-colors hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <ArchTile size={44} tone={role.tone}>
                  <role.icon size={20} strokeWidth={1.7} />
                </ArchTile>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground">
                    {role.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {role.hint}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/sign-in"
          onClick={() => setAnswered(true)}
          className="fastly-primary mt-6 w-full"
        >
          I already have an account
        </Link>
        <div className="fastly-safe-gap" aria-hidden="true" />
      </div>
    </div>
  );
}
