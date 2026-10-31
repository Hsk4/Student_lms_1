import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { RootShell } from "@/views/layout/root-shell";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * The reference kit's UI face. Geist was the Next.js starter default; Inter is
 * what the reference renders, and the metric difference shows most in table
 * cells and form labels, so this is the one that matches the design.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fastly LMS",
  description: "Learning management system",
};

/** `viewport-fit=cover` lets the native shell draw under the status bar. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // The theme script below writes `dark` here before paint; `` suppresses
      // the resulting attribute-mismatch warning during hydration.
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint, so dark mode never
            flashes white. See lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
