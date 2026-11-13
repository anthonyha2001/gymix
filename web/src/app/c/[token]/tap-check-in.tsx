"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
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
        <Loader2 className="mx-auto size-8 animate-spin text-brand" />
        <p className="mt-3 text-lg font-bold">Checking you in…</p>
      </Screen>
    );
  }

  if (!result.ok) {
    return (
      <Screen tone="bad">
        <Tile tone="bad" />
        <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-[#ff8a7a] uppercase">Couldn&apos;t check you in</p>
        <p className="mt-2 text-sm text-white/60">{result.error}</p>
        <Link href="/portal" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/15">
          Go to my portal
        </Link>
      </Screen>
    );
  }

  if (!result.allowed) {
    return (
      <Screen tone="bad">
        <Tile tone="bad" />
        <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-[#ff8a7a] uppercase">Not allowed in</p>
        <p className="mt-1 text-2xl font-black">{result.fullName}</p>
        <p className="mt-2 text-sm text-white/60">{result.reason}. Please see the front desk.</p>
        <Link href="/portal" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/15">
          Go to my portal
        </Link>
      </Screen>
    );
  }

  const firstName = result.fullName?.split(" ")[0] ?? "";
  const details = [
    result.planName,
    result.endsOn && `until ${formatDate(result.endsOn)}`,
    result.visitsLeft !== null && `${result.visitsLeft} visits left`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Screen tone="good">
      <Tile tone="good" />
      <p className="mt-3 text-[11px] font-bold tracking-[0.2em] text-brand uppercase">{result.alreadyIn ? "Already checked in" : "Checked in"}</p>
      <p className="mt-1 text-2xl font-black">Welcome{firstName ? `, ${firstName}` : " back"}</p>
      {details && <p className="mt-1 text-sm text-white/50">{details}</p>}
      <Link href="/portal/train" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-bold text-ink">
        Start training
      </Link>
      <p className="mt-2 text-xs text-white/40">Opening your training screen…</p>
    </Screen>
  );
}

function Tile({ tone }: { tone: "good" | "bad" }) {
  return tone === "good" ? (
    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-ink">
      <LogoMark className="size-9" />
    </span>
  ) : (
    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger text-white">
      <XCircle className="size-8" />
    </span>
  );
}

// Dark screen, the reader's glow and waves from the top edge, and the answer in
// a glass card near the bottom (the same look as the door on the landing page).
export function Screen({ tone, children }: { tone: "good" | "bad" | "neutral"; children: React.ReactNode }) {
  return (
    <main role="status" className={`tap-screen tap-${tone} relative flex flex-1 flex-col justify-end overflow-hidden bg-gradient-to-b from-[#121821] to-[#07090d] px-5 pt-16 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center text-white`}>
      <span key={tone} aria-hidden className={`door-waves ${tone === "neutral" ? "" : "door-waves-done"}`}>
        <i />
        <i />
        <i />
        <i />
      </span>
      <div key={`c${tone}`} className="tap-card relative mx-auto w-full max-w-sm rounded-3xl bg-white/[0.08] p-6 ring-1 ring-white/10 backdrop-blur-xl">
        {children}
      </div>
    </main>
  );
}
