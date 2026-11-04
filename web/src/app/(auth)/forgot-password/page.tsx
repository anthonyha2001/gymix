import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, Card, Skeleton } from "@/components/ui";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Forgot your password?</h1>
        <p className="text-sm text-muted">Enter the email you sign in with and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-32" />}>
        <Body searchParams={searchParams} />
      </Suspense>
      <p className="rounded-lg bg-canvas p-3 text-xs text-muted">
        Gym members who log in with a phone number or member code: ask your front desk for a new password.
      </p>
      <p className="text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </Card>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/forgot-password">["searchParams"] }) {
  const { error } = await searchParams;
  return (
    <>
      {error === "link" && <Alert tone="error">That reset link is invalid or has expired. Ask for a new one below.</Alert>}
      <ForgotPasswordForm />
    </>
  );
}
