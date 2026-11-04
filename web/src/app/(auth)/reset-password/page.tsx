import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { requireViewer } from "@/lib/session";
import { NewPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email (the link signs the visitor in first).
export default function ResetPasswordPage() {
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted">You&apos;ll use it from now on to log in.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <Gate />
      </Suspense>
    </Card>
  );
}

async function Gate() {
  // No session means the link was never opened (or expired): log in first.
  await requireViewer();
  return <NewPasswordForm />;
}
