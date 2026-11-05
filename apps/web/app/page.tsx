import type { Metadata } from "next";

import LandingPage from "@/components/brand/landing-sections";
import { SCHOOL_NAME } from "@/lib/school";
import { NativeWelcome } from "./native-welcome";

/**
 * The app entry — the one public page that matters for search.
 *
 * This is a **server component**: the marketing page is rendered to real HTML
 * at build time, so a crawler (or a browser with JavaScript disabled) sees the
 * full content and the metadata below. It used to be `"use client"`, which
 * shipped an empty shell and left the landing page invisible to search engines.
 *
 * The Capacitor app still needs its own entry screen ("Welcome. Who are you?"),
 * which depends on `window.Capacitor` and therefore cannot be server-rendered.
 * That lives in `native-welcome.tsx` as a small client island: it renders
 * nothing in a browser and covers the page in the native app.
 */

const DESCRIPTION =
  "A single-school learning platform for students, parents and teachers: " +
  "classes, attendance, assignments, fees and results in one place.";

export const metadata: Metadata = {
  title: `${SCHOOL_NAME} — One school. Everyone in the loop.`,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SCHOOL_NAME,
    title: `${SCHOOL_NAME} — One school. Everyone in the loop.`,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SCHOOL_NAME} — One school. Everyone in the loop.`,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <LandingPage />
      <NativeWelcome />
    </>
  );
}
