import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, Card, Skeleton } from "@/components/ui";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted">Log in to your gym.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-52" />}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

async function LoginBody({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error, next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const isTap = nextPath?.startsWith("/c/");

  return (
    <>
      {error === "link" && <Alert tone="error">That link is invalid or has expired. Log in or sign up again.</Alert>}
      {isTap && (
        <Alert tone="success">Log in once on this phone — after that, tapping the sticker checks you in instantly.</Alert>
      )}
      <LoginForm next={nextPath} />
      <p className="text-sm text-muted">
        New to Gymix?{" "}
        <Link
          href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
          className="font-medium text-ink underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
