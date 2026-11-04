import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookMarked,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Ellipsis,
  GraduationCap,
  House,
  Timer,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  ArchIllustration,
  HourglassIllustration,
} from "@/components/brand/illustrations";
import { ArchTile, BrandMark, NAVY, StatusChip, Star } from "@/components/brand/primitives";

/**
 * The four Fastly phone screens, 390 × 844, drawn at 1:1 and framed in a
 * display-only device bezel. No fake status bar: each screen starts with the
 * app's own header, and every screen ends with safe-area padding.
 *
 * These are design specimens, not live routes — the frame is a `<section>` so
 * nothing inside steals focus or pretends to be the real navigation.
 */

const PHONE = "fastly-phone relative";

/**
 * Splash backdrop. The jaali lattice is inlined here as a data URI rather than
 * taken from the `.fastly-jaali` class because this frame is itself the thing
 * being shown — the pattern has to survive any stylesheet change to the class.
 */
const SPLASH_BACKGROUND = {
  backgroundColor: NAVY,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.14' stroke-width='1'%3E%3Crect x='16' y='16' width='40' height='40'/%3E%3Crect x='16' y='16' width='40' height='40' transform='rotate(45 36 36)'/%3E%3Ccircle cx='36' cy='36' r='3.2'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: "72px 72px",
};



/* ------------------------------------------------------------- 1. splash */

function SplashScreen() {
  return (
    <article>
      <section
        aria-label="Splash screen"
        style={SPLASH_BACKGROUND}
        className={`${PHONE} overflow-hidden text-white`}
      >
        <div className="relative flex h-full flex-col items-center justify-center px-8 pb-20">
          <div className="flex flex-col items-center">
            <div className="relative">
              <BrandMark size={132} tone="light" star={false} />
              {/* The star sits where the arch meets its point. */}
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1.5"
                aria-hidden="true"
              >
                <Star cx={12} cy={12} r={9} />
              </svg>
            </div>
            <p className="fastly-display mt-10 text-[44px] tracking-[-0.03em]">
              fastly
            </p>
            <p className="mt-2 text-[13px] tracking-[0.02em] text-on-navy-soft">
              One school. Everyone in the loop.
            </p>
          </div>
        </div>

        {/* Three-dot loader, pinned well clear of the safe area. */}
        <div className="fastly-safe-bottom absolute inset-x-0 bottom-0 flex justify-center pb-14">
          <div
            className="flex items-center gap-2"
            role="status"
            aria-label="Loading"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="h-2 w-2 rounded-full bg-white/55" />
            <span className="h-2 w-2 rounded-full bg-on-navy-line" />
          </div>
        </div>
      </section>
    </article>
  );
}

/* ------------------------------------------------------------ 2. welcome */

const WHO = [
  {
    role: "I'm a student",
    hint: "Homework, courses and results",
    icon: GraduationCap,
    tone: "cobalt" as const,
  },
  {
    role: "I'm a parent",
    hint: "Link to your child with a code",
    icon: Users,
    tone: "tint" as const,
  },
  {
    role: "I'm a teacher",
    hint: "Classes, attendance and marks",
    icon: BookOpen,
    tone: "navy" as const,
  },
];

function WelcomeScreen() {
  return (
    <article>
      <section
        aria-label="Welcome screen"
        className={`${PHONE} flex flex-col overflow-hidden bg-white`}
      >
        {/* Top 45%: navy, with the arch. */}
        <div className="relative flex h-95 shrink-0 items-center justify-center bg-[#0a2540]">
          <div className="fastly-jaali absolute inset-0" aria-hidden="true" />
          <div className="relative flex items-center gap-4 px-6">
            <BrandMark size={64} tone="light" />
            <ArchIllustration className="h-95 w-58" />
          </div>
        </div>

        {/* White sheet, 30px top corners. */}
        <div className="fastly-sheet relative -mt-7 flex flex-1 flex-col bg-white px-6 pt-8">
          <h2 className="fastly-display text-[30px] text-[#0a2540]">
            Welcome. Who are you?
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Pick the door that fits. The school office confirms it before
            anything opens.
          </p>

          <ul className="mt-6 space-y-3">
            {WHO.map((row) => (
              <li key={row.role}>
                <button
                  type="button"
                  tabIndex={-1}
                  className="flex min-h-16 w-full items-center gap-3.5 rounded-xl border-[1.5px] border-line px-3.5 py-2.5 text-left"
                >
                  <ArchTile size={44} tone={row.tone}>
                    <row.icon size={20} strokeWidth={1.7} />
                  </ArchTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#0a2540]">
                      {row.role}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-soft">
                      {row.hint}
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-ink-faint"
                  />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            tabIndex={-1}
            className="mt-auto mb-0 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1e4db7] text-[15px] font-semibold text-white"
          >
            I already have an account
          </button>
          <div className="fastly-safe-gap" aria-hidden="true" />
        </div>
      </section>
    </article>
  );
}

/* -------------------------------------------------------- 3. student home */

const DUE = [
  {
    subject: "Mathematics",
    title: "Algebra worksheet 4.2",
    when: "Today · 9:00 PM",
    tone: "due" as const,
    chip: "Due",
  },
  {
    subject: "Urdu",
    title: "Essay: Mera Pasandeeda Mausam",
    when: "Tomorrow · 11:00 AM",
    tone: "focus" as const,
    chip: "New",
  },
  {
    subject: "Science",
    title: "Quiz revision, Chapter 6",
    when: "12 Mar · 4:00 PM",
    tone: "neutral" as const,
    chip: "Open",
  },
];

const TABS = [
  { label: "Home", icon: House, active: true },
  { label: "Courses", icon: BookMarked },
  { label: "Work", icon: ClipboardCheck },
  { label: "Fees", icon: Wallet },
  { label: "More", icon: Ellipsis },
];

function StudentHomeScreen() {
  return (
    <article>
      <section
        aria-label="Student home screen"
        className={`${PHONE} flex flex-col overflow-hidden bg-white`}
      >
        <div className="relative shrink-0 bg-[#0a2540] pb-12 text-white">
          <div className="fastly-jaali absolute inset-0" aria-hidden="true" />
          <div className="relative">
            {/* Header: mark and bell. */}
            <div className="flex items-center justify-between px-6 pb-5 pt-5">
              <div className="flex items-center gap-2.5">
                <BrandMark size={32} tone="light" />
                <span className="fastly-display text-[21px]">fastly</span>
              </div>
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-on-navy-line">
                <Bell size={19} strokeWidth={1.7} className="text-white" />
                <span
                  className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#f4b942]"
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="px-6">
              <p className="text-[12px] text-on-navy-soft">
                Monday, 10 March · Class 7-B
              </p>
              <h2 className="fastly-display mt-1.5 text-[30px] text-white">
                Good morning, Hira
              </h2>
            </div>
          </div>
        </div>

        {/* Body scrolls inside the screen; the header above it scrolls too. */}
        <div className="quiet-scroll -mt-8 flex-1 overflow-y-auto px-5">
          {/* Next class card overlaps the header. */}
          <div className="relative rounded-2xl border-[1.5px] border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
                  Next class
                </p>
                <p className="fastly-display mt-1 text-[20px] text-[#0a2540]">
                  Mathematics
                </p>
                <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                  Room 14 · Sir Adeel Ali
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-[#eaf1ff] px-2.5 py-2 text-center">
                <p className="fastly-display text-[17px] leading-none text-[#0a2540]">
                  8:30
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[#1e4db7]">
                  AM
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t-[1.5px] border-line pt-2.5 text-[12px] text-ink-soft">
              <Timer size={14} strokeWidth={1.8} className="text-[#1e4db7]" />
              Starts in 25 minutes
            </div>
          </div>

          {/* Due soon. */}
          <div className="mt-5 flex items-baseline justify-between">
            <h3 className="fastly-display text-[19px] text-[#0a2540]">
              Due soon
            </h3>
            <span className="text-[12px] font-semibold text-[#1e4db7]">
              See all
            </span>
          </div>
          <ul className="mt-2.5 overflow-hidden rounded-xl border-[1.5px] border-line">
            {DUE.map((item) => (
              <li
                key={item.title}
                className="flex min-h-15 items-center justify-between gap-3 border-b-[1.5px] border-line px-3.5 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
                    {item.subject}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-[#0a2540]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {item.when}
                  </p>
                </div>
                <StatusChip tone={item.tone}>{item.chip}</StatusChip>
              </li>
            ))}
          </ul>

          {/* Fees. */}
          <div className="mt-5 rounded-xl border-[1.5px] border-line bg-[#eaf1ff] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1e4db7]">
                  March fees
                </p>
                <p className="fastly-display mt-1 text-[24px] text-[#0a2540]">
                  Rs 12,000
                </p>
              </div>
              <StatusChip tone="due">Unpaid</StatusChip>
            </div>
            <p className="mt-1 text-[12px] text-ink-soft">
              Voucher due Friday, 14 March
            </p>
            <button
              type="button"
              tabIndex={-1}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-cobalt/30 bg-white text-[13px] font-semibold text-[#1e4db7]"
            >
              View voucher <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </div>

          {/* Teachers. */}
          <h3 className="mt-5 text-[13px] font-semibold text-[#0a2540]">
            Your teachers
          </h3>
          <div className="mt-2.5 mb-5 flex gap-2">
            {[
              { name: "Sir Adeel", subject: "Maths" },
              { name: "Ms Sana", subject: "Urdu" },
            ].map((t) => (
              <button
                key={t.name}
                type="button"
                tabIndex={-1}
                className="flex min-h-12 flex-1 items-center gap-2.5 rounded-xl border-[1.5px] border-line px-2.5 text-left"
              >
                <ArchTile size={32} tone="tint">
                  <UserRound size={16} strokeWidth={1.8} />
                </ArchTile>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[#0a2540]">
                    {t.name}
                  </span>
                  <span className="block text-[10px] text-ink-faint">
                    {t.subject}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar. Active tab sits in a pale blue pill. */}
        <nav
          aria-label="Tabs"
          className="shrink-0 border-t-[1.5px] border-line bg-white px-2 pt-2"
        >
          <ul className="flex items-stretch">
            {TABS.map((tab) => (
              <li key={tab.label} className="flex-1">
                <div
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-full py-1 ${
                    tab.active ? "bg-[#eaf1ff]" : ""
                  }`}
                >
                  <tab.icon
                    size={19}
                    strokeWidth={tab.active ? 2 : 1.7}
                    className={
                      tab.active ? "text-[#1e4db7]" : "text-ink-faint"
                    }
                  />
                  <span
                    className={`text-[10px] ${
                      tab.active
                        ? "font-semibold text-[#1e4db7]"
                        : "text-ink-faint"
                    }`}
                  >
                    {tab.label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="fastly-safe-gap" aria-hidden="true" />
        </nav>
      </section>
    </article>
  );
}

/* ------------------------------------------------------------ 4. waiting */

const TRACK = [
  { label: "Request sent", detail: "Today, 9:12 AM", state: "done" as const },
  {
    label: "School office reviewing",
    detail: "Usually cleared the same day",
    state: "now" as const,
  },
  {
    label: "Account ready",
    detail: "You will get an SMS and an email",
    state: "next" as const,
  },
];

function WaitingScreen() {
  return (
    <article>
      <section
        aria-label="Waiting for approval screen"
        className={`${PHONE} relative overflow-hidden bg-white`}
      >
        <div className="fastly-jaali-tint absolute inset-0" aria-hidden="true" />
        <div className="relative flex h-full flex-col px-6">
          <div className="flex items-center gap-2 pt-6">
            <BrandMark size={28} tone="dark" />
            <span className="fastly-display text-[18px] text-[#0a2540]">
              fastly
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
            <HourglassIllustration size={180} />
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1e4db7]">
              Request received
            </p>
            <h2 className="fastly-display mt-2 max-w-[15ch] text-[28px] text-[#0a2540]">
              Your request is with the school office
            </h2>
            <p className="mt-2.5 max-w-[30ch] text-[14px] leading-relaxed text-ink-soft">
              A teacher will confirm Hira Ahmed against the Class 7-B register.
            </p>

            <ol className="mt-7 w-full rounded-xl border-[1.5px] border-line bg-white p-4 text-left">
              {TRACK.map((step, i) => (
                <li
                  key={step.label}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  {i < TRACK.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-2.75 top-6 h-full w-[1.5px] ${
                        step.state === "done"
                          ? "bg-[#1e4db7]"
                          : "bg-line"
                      }`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      step.state === "done"
                        ? "border-[#1e4db7] bg-[#1e4db7] text-white"
                        : step.state === "now"
                          ? "border-[#1e4db7] bg-white"
                          : "border-line bg-white"
                    }`}
                  >
                    {step.state === "done" ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
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
                    ) : (
                      <span
                        className={`h-2 w-2 rounded-full ${
                          step.state === "now"
                            ? "bg-[#1e4db7]"
                            : "bg-line-strong"
                        }`}
                      />
                    )}
                  </span>
                  <div>
                    <p
                      className={`text-[13px] ${
                        step.state === "next"
                          ? "text-ink-faint"
                          : "font-semibold text-[#0a2540]"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            tabIndex={-1}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-[#1e4db7] bg-white text-[15px] font-semibold text-[#1e4db7]"
          >
            Check again
          </button>
          <div className="fastly-safe-gap" aria-hidden="true" />
        </div>
      </section>
    </article>
  );
}

/* ------------------------------------------------------------- assembly */

/**
 * 390 x 844 drawn at 1:1, then shrunk.
 *
 * The frame is a fixed 242 px box at `SCALE`, which is wider than the content
 * column on a 360 px phone once padding and `main`'s gutters are subtracted.
 * `max-w-full` lets the *outer* box shrink; the inner 390 px canvas keeps its
 * size and is scaled uniformly by the same factor, so the screen is never
 * squeezed out of proportion — only shown a little smaller.
 */
const SCALE = 0.62;
const PHONE_W = 390;
const PHONE_H = 844;

function ScaledPhone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto shrink-0 [--phone-scale:0.54] sm:[--phone-scale:0.62]"
      style={{
        width: `min(${PHONE_W * SCALE}px, 100%)`,
        height: `calc(${PHONE_H}px * var(--phone-scale))`,
      }}
    >
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          transform: "scale(var(--phone-scale))",
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const SCREENS = [
  {
    n: "01",
    name: "Splash",
    screen: <SplashScreen />,
    summary:
      "The first frame is calm and branded: the arch mark on navy, the jaali lattice behind it, and the promise in one line.",
    points: [
      "Three-dot loader sits clear of the bottom safe area",
      "No fake status bar; the device draws its own",
      "Brand mark, wordmark and tagline only; nothing to tap",
    ],
  },
  {
    n: "02",
    name: "Welcome",
    screen: <WelcomeScreen />,
    summary:
      "Three doors: student, parent and teacher. Choosing one starts a request; the school office confirms it before anything opens.",
    points: [
      "Student: homework, courses and results",
      "Parent: link to your child with a code",
      "Teacher: classes, attendance and marks",
      "Returning users skip ahead with \u201cI already have an account\u201d",
    ],
  },
  {
    n: "03",
    name: "Student home",
    screen: <StudentHomeScreen />,
    summary:
      "What a student opens at 8 a.m.: the next class, what is due, and the month's fee status, in the order they matter.",
    points: [
      "Next class card overlaps the header for quick glance",
      "Due soon list with Due / New / Open chips",
      "Fees voucher with paid status",
      "Bottom tabs: Home, Courses, Work, Fees, More",
    ],
  },
  {
    n: "04",
    name: "Waiting for approval",
    screen: <WaitingScreen />,
    summary:
      "After a request is sent, the account waits for the school office. The screen says where things stand instead of leaving a blank wait.",
    points: [
      "Timeline: request sent, office reviewing, account ready",
      "\u201cCheck again\u201d refreshes the status on demand",
      "Opens the right home automatically once approved",
    ],
  },
];

export default function MobileScreensPage() {
  return (
    <div className="min-h-screen bg-[#eaf1ff] font-sans">
      {/*
       * Header: two rows below `sm`. At 390px, brand + "App screens" + an
       * outlined button on one line left every item squeezed against the
       * next; the label is dropped to a second row and the button shrinks.
       */}
      <header className="relative bg-[#0a2540] text-white">
        <div className="fastly-jaali absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex w-full max-w-300 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <BrandMark size={28} tone="light" />
              <span className="fastly-display text-[19px]">fastly</span>
            </Link>
            <span
              className="h-5 w-px bg-on-navy-line"
              aria-hidden="true"
            />
            <p className="text-[13px] text-on-navy-soft">App screens</p>
          </div>
          <Link
            href="/"
            className="fastly-outline min-h-11 border-[1.5px] border-on-navy-line px-3 text-[13px] text-white hover:border-white/60 hover:bg-white/6 sm:px-4"
          >
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to the site</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-300 px-4 py-10 sm:px-6 sm:py-12 lg:py-16">
        <p className="fastly-eyebrow text-[#1e4db7]">App screens</p>
        <h1 className="fastly-display mt-2 max-w-[24ch] text-[30px] leading-[1.08] text-[#0a2540] sm:text-[40px]">
          Four screens, one calm school day.
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
          The whole app in four frames: the splash, the welcome where a student,
          parent or teacher picks a door, the student home with the next class,
          due work and fees, and the waiting screen while the school office
          approves a request.
        </p>
        <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-faint">
          Every action is thumb-reachable, at least 48&nbsp;px tall, and clear of
          the bottom safe area. Each screen is drawn at 62% of its real
          390&nbsp;&times;&nbsp;844 size, so it fits a phone without scrolling
          sideways.
        </p>

        <ol className="mt-10 space-y-12 sm:mt-12 sm:space-y-14 lg:mt-16 lg:space-y-20">
          {SCREENS.map((s) => (
            <li
              key={s.n}
              className="grid grid-cols-1 items-center justify-items-center gap-6 sm:gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:justify-items-start md:gap-14"
            >
              <ScaledPhone>{s.screen}</ScaledPhone>

              <div className="w-full max-w-[52ch] min-w-0 text-center md:text-left">
                <p className="flex items-baseline gap-2.5">
                  <span className="fastly-display text-[15px] tabular-nums text-[#1e4db7]">
                    {s.n}
                  </span>
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-ink-soft">
                    {s.name}
                  </span>
                </p>
                <h2 className="fastly-display mt-2 text-[26px] leading-tight text-[#0a2540] sm:text-[32px]">
                  {s.name}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {s.summary}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="flex gap-3 text-[14px] leading-relaxed text-[#0a2540]"
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f4b942]"
                        aria-hidden="true"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
