"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { selfCheckIn, simulatedCheckIn, type TapResult } from "./actions";

// Runs the check-in as soon as the page opens (the member just tapped), shows a
// welcome screen, then moves on to the training screen.
// Running twice is harmless: a repeat within 3 hours counts as "already in".
export function TapCheckIn({ token, simulated = false }: { token?: string; simulated?: boolean }) {
  const [result, setResult] = useState<TapResult | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const r = simulated || !token ? await simulatedCheckIn() : await selfCheckIn(token);
      setResult(r);
      if (r.ok && r.allowed) {
        navigator.vibrate?.(80);
        setTimeout(() => router.push("/portal/train"), 2500);
      }
    });
  }, [token, simulated, router]);

  if (!result) {
    return (
      <Screen tone="neutral">
        <Loader2 className="size-16 animate-spin" />
        <p className="text-2xl font-semibold">Checking you in…</p>
      </Screen>
    );
  }

  if (!result.ok) {
    return (
      <Screen tone="bad">
        <XCircle className="size-20" />
        <p className="text-2xl font-semibold">Couldn&apos;t check you in</p>
        <p className="max-w-xs text-base opacity-90">{result.error}</p>
        <Link href="/portal" className={buttonClass("secondary", "mt-4")}>
          Go to my portal
        </Link>
      </Screen>
    );
  }

  if (!result.allowed) {
    return (
      <Screen tone="bad">
        <XCircle className="size-20" />
        <p className="text-3xl font-bold">Not allowed in</p>
        <p className="text-lg font-medium">{result.fullName}</p>
        <p className="max-w-xs text-base opacity-90">{result.reason}. Please see the front desk.</p>
        <Link href="/portal" className={buttonClass("secondary", "mt-4")}>
          Go to my portal
        </Link>
      </Screen>
    );
  }

  const firstName = result.fullName?.split(" ")[0] ?? "";
  return (
    <Screen tone="good">
      <CheckCircle2 className="size-20" />
      <p className="text-sm font-medium uppercase tracking-widest opacity-80">{result.alreadyIn ? "Already checked in" : "Checked in"}</p>
      <p className="text-4xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""}</p>
      <p className="text-base opacity-90">
        {[
          result.planName,
          result.endsOn && `until ${formatDate(result.endsOn)}`,
          result.visitsLeft !== null && `${result.visitsLeft} visits left`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <Link href="/portal/train" className={buttonClass("secondary", "mt-6 h-12 px-8 text-base")}>
        Start training
      </Link>
      <p className="text-xs opacity-75">Opening your training screen…</p>
    </Screen>
  );
}

function Screen({ tone, children }: { tone: "good" | "bad" | "neutral"; children: React.ReactNode }) {
  const styles = {
    good: "bg-success text-white",
    bad: "bg-danger text-white",
    neutral: "bg-ink text-white",
  }[tone];
  return (
    <main role="status" className={`flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center ${styles}`}>
      {children}
    </main>
  );
}
