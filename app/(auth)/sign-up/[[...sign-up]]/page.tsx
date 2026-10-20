import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth/roles";

export const instant = false;

async function Gate() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}

export default function SignUpPage() {
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
