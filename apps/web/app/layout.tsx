import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import AuthRedirector from "@/components/auth-redirector";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
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
          <AuthRedirector />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
