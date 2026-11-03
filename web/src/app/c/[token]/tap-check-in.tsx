"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { selfCheckIn, type TapResult } from "./actions";

// Checks the member in as soon as the page opens (they just tapped the sticker).
// Running twice is harmless: the database treats a repeat within 3 hours as "already in".
export function TapCheckIn({ token }: { token: string }) {
  const [result, setResult] = useState<TapResult | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await selfCheckIn(token);
      setResult(r);
      if (r.ok && r.allowed) navigator.vibrate?.(80);
    });
  }, [token]);

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
      </Screen>
    );
  }

  return (
    <Screen tone="good">
      <CheckCircle2 className="size-20" />
      <p className="text-3xl font-bold">{result.alreadyIn ? "You're already in" : "Welcome!"}</p>
      <p className="text-xl font-medium">{result.fullName}</p>
      <p className="text-base opacity-90">
        {[
          result.planName,
          result.endsOn && `until ${formatDate(result.endsOn)}`,
          result.visitsLeft !== null && `${result.visitsLeft} visits left`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-6 text-sm opacity-75">Have a great workout 💪</p>
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
