'use client';

import { SignIn, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const instant = false;

export default function SignInPage() {
  const { isLoaded, signIn } = useSignIn();
  const router = useRouter();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Poll for user status after sign-in
  useEffect(() => {
    if (!isLoaded || !signIn?.createdSessionId) return;

    setIsCheckingStatus(true);

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/status", {
          method: "GET",
          headers: { "Cache-Control": "no-store" },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.signedIn && data.home) {
            router.push(data.home);
          }
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }
    };

    // Check immediately, then every 500ms for 5 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 500);

    return () => clearInterval(interval);
  }, [isLoaded, signIn?.createdSessionId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      {isCheckingStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="rounded-[var(--radius-card)] border border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">Signing you in...</p>
            <div className="mt-4 h-2 w-32 overflow-hidden rounded-full bg-border">
              <div className="h-full w-1/3 animate-pulse bg-primary"></div>
            </div>
          </div>
        </div>
      )}
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        redirectUrl="/"
      />
    </div>
  );
}
