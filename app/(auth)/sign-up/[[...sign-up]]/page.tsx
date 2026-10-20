'use client';

import { SignUp, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const instant = false;

export default function SignUpPage() {
  const { isLoaded, signUp } = useSignUp();
  const router = useRouter();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Poll for user status after sign-up
  useEffect(() => {
    if (!isLoaded || !signUp?.createdSessionId) return;

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
  }, [isLoaded, signUp?.createdSessionId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      {isCheckingStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="rounded-[var(--radius-card)] border border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">Setting up your account...</p>
            <div className="mt-4 h-2 w-32 overflow-hidden rounded-full bg-border">
              <div className="h-full w-1/3 animate-pulse bg-primary"></div>
            </div>
          </div>
        </div>
      )}
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        redirectUrl="/"
      />
    </div>
  );
}
