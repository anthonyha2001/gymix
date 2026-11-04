"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { reportClientError } from "@/lib/report-error";

// Shown when a page fails. The error is reported so it shows up in /admin.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          This page couldn&apos;t load. We&apos;ve been notified. Try again, or go back to the start.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => retry()} className={buttonClass("primary", "h-10 px-4")}>
            Try again
          </button>
          <Link href="/start" className={buttonClass("secondary", "h-10 px-4")}>
            Go home
          </Link>
        </div>
        {digest && <p className="mt-6 text-xs text-muted">Reference: {digest}</p>}
      </div>
    </div>
  );
}
