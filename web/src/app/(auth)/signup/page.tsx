import { getPricing } from "@/lib/pricing-server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { trialDays } = await getPricing();
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">Gym owners: your first {trialDays} days are free. Staff and members: use the invite your gym sent you.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <SignupBody searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

async function SignupBody({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const { next, email } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  return (
    <>
      <SignupForm next={nextPath} email={typeof email === "string" ? email : undefined} />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          className="font-medium text-ink underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
