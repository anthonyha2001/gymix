import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">For gym owners, staff and members.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <SignupBody searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

async function SignupBody({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  return (
    <>
      <SignupForm next={nextPath} />
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
