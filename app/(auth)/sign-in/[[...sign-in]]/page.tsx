export const instant = false;

import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";

async function Gate() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <Gate />
    </Suspense>
  );
}
