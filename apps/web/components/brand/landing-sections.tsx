"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookMarked,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  House,
  KeyRound,
  LifeBuoy,
  ReceiptText,
  ShieldCheck,
  Timer,
  UserRoundCheck,
  Users,
  Wallet,
} from "lucide-react";
import { ArchIllustration, WaitingIllustration } from "./illustrations";
import {
  ArchNumber,
  ArchTile,
  BrandMark,
  Eyebrow,
  Jaali,
  Pill,
  StatusChip,
} from "./primitives";

/* ------------------------------------------------------------- helpers */

/** 1.5px borders everywhere; depth never comes from a shadow. */
const CARD = "rounded-2xl border-[1.5px] border-line bg-white";
const GOLD_CTA = "fastly-cta";
const OUTLINE_ON_NAVY =
  "fastly-outline border-[1.5px] border-on-navy-line text-white hover:border-white/60 hover:bg-white/[0.06]";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 8.5 6.2 12 13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- 1 */

function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[#0a2540] text-white"
      aria-labelledby="hero-title"
    >
      <Jaali tone="navy" />
      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="flex flex-col items-start">
          <Pill>
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#f4b942]"
              aria-hidden="true"
            />
            For Beaconhouse Garden Town Campus
          </Pill>

          <h1
            id="hero-title"
            className="fastly-display mt-7 max-w-[15ch] text-[40px] text-white sm:text-[56px] lg:text-[64px]"
          >
            One school.
            <br />
            Everyone in the loop.
          </h1>

          <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-on-navy-soft sm:text-lg">
            Homework, marks, attendance and fee vouchers in one place — for
            students, parents and teachers at your own school.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Link href="/sign-up" className={GOLD_CTA}>
              Create an account
              <ArrowRight size={18} strokeWidth={2.2} />
            </Link>
            <Link href="/sign-in" className={OUTLINE_ON_NAVY}>
              I already have one
            </Link>
          </div>

          <p className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-navy-soft">
            <span className="inline-flex items-center gap-2">
              <KeyRound
                size={16}
                strokeWidth={1.8}
                className="text-[#f4b942]"
                aria-hidden="true"
              />
              A parent or guardian?
            </span>
            <Link
              href="/sign-up/parent"
              className="inline-flex min-h-12 items-center font-semibold text-white underline decoration-[#f4b942] decoration-2 underline-offset-4 hover:text-[#f4b942]"
            >
              Link with a code
            </Link>
          </p>
        </div>

        <HeroIllustration />
      </div>
    </section>
  );
}

/** The illustration plus its three floating cards, shared by the hero and the dashboard peek. */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[548px]">
      <ArchIllustration className="block w-full" />

      {/* Homework due — top left, over the navy. */}
      <div
        className={`${CARD} absolute left-0 top-[20%] w-[188px] p-3 sm:w-[212px]`}
      >
        <div className="flex items-start gap-2.5">
          <ArchTile size={32} tone="tint">
            <BookOpen size={15} strokeWidth={1.8} className="text-[#1e4db7]" />
          </ArchTile>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
              Homework due
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold text-[#0a2540]">
              Urdu essay, Class 7-B
            </p>
            <p className="mt-0.5 text-[11px] text-ink-soft">Today, 9:00 PM</p>
          </div>
        </div>
      </div>

      {/* Fee voucher — bottom right, over the pale-blue arch. */}
      <div
        className={`${CARD} absolute bottom-[1%] right-0 w-[196px] p-3 sm:w-[216px]`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
            Fee voucher
          </p>
          <StatusChip tone="paid">Paid</StatusChip>
        </div>
        <p className="fastly-display mt-2 text-[22px] text-[#0a2540]">Rs 12,000</p>
        <p className="mt-1 text-[11px] text-ink-soft">
          March · challan #MV-2291
        </p>
      </div>

      {/* Attendance — top right, straddling the outer arch edge. */}
      <div
        className={`${CARD} absolute right-0 top-[29%] w-[210px] p-3 sm:w-[238px]`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
            Attendance this month
          </p>
          <StatusChip tone="paid">96%</StatusChip>
        </div>
        <div className="mt-2.5 flex gap-1" aria-hidden="true">
          {[1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0].map((on, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-[2px] ${on ? "bg-[#1e4db7]" : "bg-line-strong"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">24 of 25 days present</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- 2 */

const DOORS = [
  {
    role: "Students",
    icon: GraduationCap,
    line1: "Your homework, marks and timetable",
    line2: "for every class you are enrolled in.",
    cta: "Student sign-up",
    href: "/sign-up",
    tile: "cobalt" as const,
  },
  {
    role: "Parents",
    icon: Users,
    line1: "Your child's week and fee vouchers",
    line2: "from one dashboard, linked by code.",
    cta: "Parent sign-up",
    href: "/sign-up/parent",
    tile: "tint" as const,
  },
  {
    role: "Teachers",
    icon: BookOpen,
    line1: "Mark attendance and publish results",
    line2: "without chasing paper registers.",
    cta: "Teacher sign-up",
    href: "/sign-up",
    tile: "navy" as const,
  },
];

function ThreeDoors() {
  return (
    <section
      className="relative bg-white py-20 lg:py-24"
      aria-labelledby="doors-title"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>How Fastly works</Eyebrow>
            <h2
              id="doors-title"
              className="fastly-display mt-3 text-[32px] text-[#0a2540] sm:text-[42px]"
            >
              Three doors into one school
            </h2>
          </div>
          <p className="max-w-[42ch] text-[15px] leading-relaxed text-ink-soft">
            Each role sees its own dashboard. All three look at the same
            records, so nobody has to forward a screenshot at midnight.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {DOORS.map((door) => {
            const Icon = door.icon;
            return (
              <article key={door.role} className={`${CARD} flex flex-col p-6`}>
                <ArchTile size={64} tone={door.tile}>
                  <Icon size={26} strokeWidth={1.6} />
                </ArchTile>
                <h3 className="fastly-display mt-6 text-[26px] text-[#0a2540]">
                  {door.role}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-soft">
                  {door.line1}
                  <br />
                  {door.line2}
                </p>
                <Link
                  href={door.href}
                  className="fastly-outline mt-6 w-full border-[1.5px] border-line-strong text-[#0a2540] hover:border-cobalt hover:bg-[#eaf1ff]"
                >
                  {door.cta}
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border-[1.5px] border-cobalt/20 bg-[#eaf1ff] px-5 py-4">
          <ShieldCheck
            size={20}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-[#1e4db7]"
            aria-hidden="true"
          />
          <p className="text-[15px] leading-relaxed text-[#0a2540]">
            <span className="font-semibold">Nobody picks their own role.</span>{" "}
            The school office confirms it, so a student cannot mark attendance
            for a whole class.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- 3 */

const STEPS = [
  {
    title: "You ask once",
    body: "Sign up with your name, board and class, or a parent's link code. One short form, no paperwork.",
  },
  {
    title: "The office checks",
    body: "A class teacher or the admin confirms who you are against the school register.",
  },
  {
    title: "Your dashboard opens",
    body: "You get the right door — student, parent or teacher — and every screen after it is yours alone.",
  },
];

function AskOnce() {
  return (
    <section
      className="relative bg-[#eaf1ff] py-20 lg:py-24"
      aria-labelledby="ask-title"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-14 px-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-20 lg:px-10">
        <div>
          <Eyebrow>One request</Eyebrow>
          <h2
            id="ask-title"
            className="fastly-display mt-3 text-[32px] text-[#0a2540] sm:text-[42px]"
          >
            Ask once.
            <br />
            The school office does the rest.
          </h2>
          <ol className="mt-10 space-y-7">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <ArchNumber
                  n={i + 1}
                  size={44}
                  tone={i === 0 ? "cobalt" : "outline"}
                />
                <div className="pt-0.5">
                  <h3 className="text-[17px] font-semibold text-[#0a2540]">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-[40ch] text-[15px] leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={`${CARD} p-7`}>
          <div className="flex items-start gap-4">
            <WaitingIllustration size={92} />
            <div className="pt-2">
              <StatusChip tone="due">Awaiting approval</StatusChip>
              <p className="fastly-display mt-3 text-[22px] leading-tight text-[#0a2540]">
                Hira&rsquo;s request is with the office
              </p>
              <p className="mt-1.5 text-[13px] text-ink-soft">
                Usually cleared the same day.
              </p>
            </div>
          </div>

          <ol className="mt-7 space-y-0 border-t-[1.5px] border-line pt-5">
            {[
              { label: "Request sent", state: "done" as const },
              { label: "School office reviewing", state: "now" as const },
              { label: "Account ready", state: "next" as const },
            ].map((s, i) => (
              <li
                key={s.label}
                className="relative flex items-center gap-3 pb-5 last:pb-0"
              >
                {i < 2 ? (
                  <span
                    className={`absolute left-[11px] top-6 h-full w-[1.5px] ${s.state === "done" ? "bg-[#1e4db7]" : "bg-line-strong"}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    s.state === "done"
                      ? "border-[#1e4db7] bg-[#1e4db7] text-white"
                      : s.state === "now"
                        ? "border-[#1e4db7] bg-white text-[#1e4db7]"
                        : "border-line-strong bg-white text-transparent"
                  }`}
                >
                  {s.state === "done" ? (
                    <Check />
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full ${s.state === "now" ? "bg-[#1e4db7]" : "bg-line-strong"}`}
                    />
                  )}
                </span>
                <span
                  className={`text-[14px] ${s.state === "next" ? "text-ink-faint" : "font-medium text-[#0a2540]"}`}
                >
                  {s.label}
                </span>
                {s.state === "now" ? (
                  <span className="ml-auto text-[12px] font-medium text-[#1e4db7]">
                    Now
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- 4 */

const PEEK_ASSIGNMENTS = [
  {
    subject: "Mathematics",
    title: "Algebra worksheet, Exercise 4.2",
    due: "Due today · 9:00 PM",
    chip: "due" as const,
  },
  {
    subject: "Urdu",
    title: "Essay: Mera Pasandeeda Mausam",
    due: "Due tomorrow · 11:00 AM",
    chip: "focus" as const,
  },
  {
    subject: "Science",
    title: "Chapter 6 quiz revision notes",
    due: "Due 12 Mar · 4:00 PM",
    chip: "neutral" as const,
  },
];

function ProductPeek() {
  return (
    <section
      className="relative bg-white py-20 lg:py-24"
      aria-labelledby="peek-title"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>The student dashboard</Eyebrow>
            <h2
              id="peek-title"
              className="fastly-display mt-3 text-[32px] text-[#0a2540] sm:text-[42px]"
            >
              What a student opens at 8 a.m.
            </h2>
          </div>
          <p className="max-w-[40ch] text-[15px] leading-relaxed text-ink-soft">
            Everything that matters today, in the order it matters: what is due,
            what is paid, and where the next class is.
          </p>
        </div>

        <BrowserFrame>
          <div className="flex min-h-[470px]">
            {/* Navy sidebar. */}
            <aside className="hidden w-[184px] shrink-0 flex-col gap-1 bg-[#0a2540] p-4 text-white sm:flex">
              <div className="flex items-center gap-2.5 px-2 pb-5">
                <BrandMark size={26} tone="light" />
                <span className="fastly-display text-[18px]">fastly</span>
              </div>
              {[
                { label: "Home", icon: House, active: true },
                { label: "Courses", icon: BookMarked },
                { label: "Work", icon: ClipboardCheck },
                { label: "Fees", icon: Wallet },
                { label: "Timetable", icon: Timer },
              ].map((item) => (
                <span
                  key={item.label}
                  className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] ${
                    item.active
                      ? "bg-white/10 font-semibold text-white"
                      : "text-on-navy-soft"
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.7} />
                  {item.label}
                </span>
              ))}
              <div className="mt-auto rounded-xl border-[1.5px] border-on-navy-line p-3">
                <p className="text-[12px] font-semibold text-white">
                  Sindh Board · Class 7-B
                </p>
                <p className="mt-1 text-[11px] text-on-navy-soft">
                  Beaconhouse Garden Town
                </p>
              </div>
            </aside>

            {/* Dashboard body. */}
            <div className="flex-1 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] text-ink-soft">Monday, 10 March</p>
                  <p className="fastly-display mt-1 text-[26px] text-[#0a2540]">
                    Good morning, Hira
                  </p>
                </div>
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line text-[#0a2540]">
                  <Bell size={17} strokeWidth={1.8} />
                  <span
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f4b942]"
                    aria-hidden="true"
                  />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { k: "Due this week", v: "6", s: "2 overdue soon" },
                  { k: "Attendance", v: "96%", s: "24 of 25 days" },
                  { k: "Average grade", v: "A−", s: "Across 7 subjects" },
                ].map((stat) => (
                  <div
                    key={stat.k}
                    className="rounded-xl border-[1.5px] border-line px-3 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1e4db7]">
                      {stat.k}
                    </p>
                    <p className="fastly-display mt-1 text-[22px] text-[#0a2540]">
                      {stat.v}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-faint">
                      {stat.s}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_196px]">
                <div className="rounded-xl border-[1.5px] border-line">
                  <div className="flex items-center justify-between border-b-[1.5px] border-line px-4 py-2.5">
                    <p className="text-[13px] font-semibold text-[#0a2540]">
                      Due soon
                    </p>
                    <span className="text-[11px] font-medium text-[#1e4db7]">
                      View all
                    </span>
                  </div>
                  <ul className="divide-y-[1.5px] divide-line">
                    {PEEK_ASSIGNMENTS.map((a) => (
                      <li
                        key={a.title}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1e4db7]">
                            {a.subject}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] font-medium text-[#0a2540]">
                            {a.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-faint">
                            {a.due}
                          </p>
                        </div>
                        <StatusChip tone={a.chip}>
                          {a.chip === "due"
                            ? "Due"
                            : a.chip === "focus"
                              ? "New"
                              : "Open"}
                        </StatusChip>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border-[1.5px] border-line bg-[#eaf1ff] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1e4db7]">
                    Fees
                  </p>
                  <p className="fastly-display mt-1 text-[22px] text-[#0a2540]">
                    Rs 12,000
                  </p>
                  <StatusChip tone="paid" className="mt-1">
                    March · Paid
                  </StatusChip>
                  <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
                    Next voucher arrives on 1 April.
                  </p>
                  <span className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg border-[1.5px] border-cobalt/25 bg-white px-3 text-[12px] font-semibold text-[#1e4db7]">
                    View voucher <ArrowRight size={13} strokeWidth={2.2} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </section>
  );
}

/** A browser frame: title bar, address field, then the page. */
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${CARD} mt-12 overflow-hidden`}>
      <div className="flex items-center gap-2 border-b-[1.5px] border-line bg-[#eaf1ff] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-cobalt/35" />
          <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-cobalt/35" />
          <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-cobalt/35" />
        </span>
        <span className="ml-2 flex min-h-7 flex-1 items-center gap-2 rounded-md border-[1.5px] border-line bg-white px-3 text-[11px] text-ink-soft">
          <ShieldCheck
            size={12}
            strokeWidth={1.8}
            className="text-[#1e4db7]"
            aria-hidden="true"
          />
          app.fastly.pk / student / home
        </span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- 5 */

const FEATURES = [
  {
    icon: BookOpen,
    title: "Homework and grades",
    body: "Assignments with due times, marks and feedback the moment a teacher publishes them.",
  },
  {
    icon: CalendarClock,
    title: "Attendance",
    body: "Daily marking per class, with the month's total shown plainly to the student and parent.",
  },
  {
    icon: ReceiptText,
    title: "Fees in rupees",
    body: "Voucher amount, due date and paid status — no currency conversion, no guesswork.",
  },
  {
    icon: Users,
    title: "A view for parents",
    body: "One dashboard per child: what is due, what is paid, and how the term is going.",
  },
  {
    icon: UserRoundCheck,
    title: "Meetings with teachers",
    body: "Ask for a parent–teacher slot and see the confirmed time in the same app.",
  },
  {
    icon: LifeBuoy,
    title: "Support desk",
    body: "Write to the school office in-app. Every request is tracked until someone replies.",
  },
];

function Features() {
  return (
    <section
      className="relative bg-[#eaf1ff] py-20 lg:py-24"
      aria-labelledby="features-title"
    >
      <Jaali tone="tint" />
      <div className="relative mx-auto w-full max-w-[1200px] px-6 lg:px-10">
        <Eyebrow>Built for a real school day</Eyebrow>
        <h2
          id="features-title"
          className="fastly-display mt-3 max-w-[20ch] text-[32px] text-[#0a2540] sm:text-[42px]"
        >
          Small things done properly
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <article key={f.title} className={`${CARD} p-6`}>
              <ArchTile size={56} tone={i % 3 === 0 ? "cobalt" : "tint"}>
                <f.icon size={22} strokeWidth={1.6} />
              </ArchTile>
              <h3 className="fastly-display mt-5 text-[22px] text-[#0a2540]">
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- 6 */

const PARENT_STEPS = [
  {
    n: "01",
    title: "Ask your child",
    body: 'They open Fastly, tap "Link a parent" and a six-character code appears.',
  },
  {
    n: "02",
    title: "Enter the code",
    body: "Type it on this screen. It works once and expires in 24 hours.",
  },
  {
    n: "03",
    title: "Send the request",
    body: "The school office confirms the link, so only guardians get in.",
  },
  {
    n: "04",
    title: "See their week",
    body: "Homework, attendance, fees and meetings, all for that child.",
  },
];

function ParentCode() {
  return (
    <section
      className="relative overflow-hidden bg-[#0a2540] py-20 text-white lg:py-24"
      aria-labelledby="code-title"
    >
      <Jaali tone="navy" />
      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-14 px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20 lg:px-10">
        <div>
          <Eyebrow dark>For parents and guardians</Eyebrow>
          <h2
            id="code-title"
            className="fastly-display mt-3 text-[32px] text-white sm:text-[42px]"
          >
            Join with a code from your child
          </h2>
          <ol className="mt-9 space-y-6">
            {PARENT_STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span
                  className="fastly-display mt-0.5 text-[15px] tabular-nums text-[#f4b942]"
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-1 max-w-[42ch] text-[14px] leading-relaxed text-on-navy-soft">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/sign-up/parent" className={`${GOLD_CTA} mt-9`}>
            Link my child
            <ArrowRight size={18} strokeWidth={2.2} />
          </Link>
        </div>

        <div className={`${CARD} p-7`}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
            Link code
          </p>
          <p className="fastly-display mt-2 text-[22px] text-[#0a2540]">
            Type the code Hira gave you
          </p>

          <div
            className="mt-5 flex justify-between gap-1.5"
            aria-label="Eight character code, example H7K2M9QF"
          >
            {"H7K2M9QF".split("").map((ch, i) => (
              <span
                key={i}
                className={`flex h-[52px] flex-1 items-center justify-center rounded-lg border-[1.5px] text-[20px] font-semibold tabular-nums ${
                  i < 3
                    ? "border-[#1e4db7] bg-[#eaf1ff] text-[#0a2540]"
                    : "border-line bg-white text-ink-faint"
                }`}
                aria-hidden="true"
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
            <KeyRound
              size={14}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-[#1e4db7]"
              aria-hidden="true"
            />
            One use only. Ask your child for a fresh code if this one expires.
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-lg border-[1.5px] border-[#0b7f8f]/25 bg-[#e6f3f4] px-3 py-2.5 text-[12px] font-medium text-[#075e6a]">
            <Check />
            Linked to Hira Ahmed · Class 7-B
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- 7 */

const BOARDS = [
  "Sindh Board",
  "Aga Khan Board",
  "Federal Board",
  "Cambridge O and A Level",
];

function Closing() {
  return (
    <section
      className="bg-white pb-20 pt-20 lg:pb-24 lg:pt-20"
      aria-labelledby="closing-title"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Eyebrow>One syllabus at a time</Eyebrow>
            <h2 className="fastly-display mt-3 text-[28px] text-[#0a2540] sm:text-[34px]">
              Set up for the board your school follows
            </h2>
          </div>
          <ul className="flex flex-wrap gap-2.5">
            {BOARDS.map((board) => (
              <li key={board}>
                <Pill tone="cobalt">
                  <StarDot />
                  {board}
                </Pill>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-2xl bg-[#1e4db7] px-7 py-12 text-white sm:px-12 sm:py-14">
          <Jaali tone="navy" className="opacity-60" />
          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[34ch]">
              <h2
                id="closing-title"
                className="fastly-display text-[30px] text-white sm:text-[40px]"
              >
                Bring your school into the loop.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                Students and teachers sign up today. Parents join with a code
                from their child.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link href="/sign-up" className={GOLD_CTA}>
                Create an account
                <ArrowRight size={18} strokeWidth={2.2} />
              </Link>
              <Link
                href="/sign-up/parent"
                className="fastly-outline border-[1.5px] border-white/40 text-white hover:border-white hover:bg-white/10"
              >
                I&rsquo;m a parent
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A tiny gold star used as a bullet in the board chips. */
function StarDot() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.5 14 10l7.5 2-7.5 2-2 7.5L10 14l-7.5-2L10 10Z"
        fill="#F4B942"
      />
    </svg>
  );
}

function Footer() {
  return (
    <footer
      className="relative overflow-hidden bg-[#0a2540] text-white"
      aria-label="Fastly"
    >
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:px-10">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} tone="light" />
            <span className="fastly-display text-[22px]">fastly</span>
          </div>
          <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-on-navy-soft">
            A single-school learning platform for students, parents and teachers
            in Pakistan.
          </p>
        </div>

        {[
          {
            head: "For students",
            links: ["Sign up", "Sign in", "Courses", "Homework"],
          },
          {
            head: "For parents",
            links: [
              "Link with a code",
              "Fee vouchers",
              "Attendance",
              "Meetings",
            ],
          },
          {
            head: "For teachers",
            links: ["Class register", "Publish results", "Support desk"],
          },
        ].map((col) => (
          <nav key={col.head} aria-label={col.head}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-on-navy-soft">
              {col.head}
            </p>
            <ul className="mt-2">
              {col.links.map((l) => (
                <li key={l}>
                  <Link
                    href="/sign-up"
                    className="inline-flex min-h-12 items-center text-[14px] text-white/90 hover:text-[#f4b942] hover:underline"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t-[1.5px] border-on-navy-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-6 py-6 text-[12px] text-on-navy-soft sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© 2026 Fastly. Built for schools in Pakistan.</p>
          <div className="flex items-center gap-2">
            <Link
              href="/mobile"
              className="inline-flex min-h-12 items-center px-2 hover:text-white hover:underline"
            >
              App screens
            </Link>
            <span
              aria-hidden="true"
              className="h-3 w-[1.5px] bg-on-navy-line"
            />
            <Link
              href="/sign-in"
              className="inline-flex min-h-12 items-center px-2 hover:text-white hover:underline"
            >
              Privacy and support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- assembly */

/**
 * The whole landing page. A signed-in visitor is sent home by `AuthRedirector`,
 * so the hero's calls to action are all plain links to the auth routes.
 */
export function FastlyLanding() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="flex flex-1 flex-col bg-white font-sans">
      <SiteHeader />
      {error === "account_suspended" ? (
        <div className="bg-status-red-soft px-6 py-3 text-center text-sm font-medium text-status-red">
          This account is suspended. Contact the school office.
        </div>
      ) : null}
      <main className="flex-1">
        <Hero />
        <ThreeDoors />
        <AskOnce />
        <ProductPeek />
        <Features />
        <ParentCode />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

/** Transparent over the navy hero, so the jaali runs edge to edge. */
function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="flex min-h-12 items-center gap-2.5 text-white"
          aria-label="Fastly home"
        >
          <BrandMark size={30} tone="light" />
          <span className="fastly-display text-[22px]">fastly</span>
        </Link>
        <nav
          className="hidden items-center gap-1 text-[14px] text-on-navy-soft md:flex"
          aria-label="Primary"
        >
          {[
            { href: "#doors-title", label: "Roles" },
            { href: "#ask-title", label: "Approval" },
            { href: "#features-title", label: "Features" },
            { href: "#code-title", label: "Parents" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-12 items-center rounded-lg px-3 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden min-h-12 items-center rounded-lg px-3 text-[14px] font-semibold text-white hover:text-[#f4b942] sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/mobile"
            className="fastly-outline border-[1.5px] border-on-navy-line px-4 text-[13px] text-white hover:border-white/60 hover:bg-white/[0.06]"
          >
            App screens
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-white p-10 text-sm text-ink-soft">
          Loading…
        </div>
      }
    >
      <FastlyLanding />
    </Suspense>
  );
}
