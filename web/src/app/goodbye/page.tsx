import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Goodbye" };

// Shown once an account has been deleted.
export default function GoodbyePage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center text-white">
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="bye-ring" />
        <span className="bye-ring" />
        <span className="bye-ring" />
      </span>
      <div className="page-enter relative">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Account deleted</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">See you around.</h1>
        <p className="mx-auto mt-3 max-w-xs text-white/60">
          Your login and personal data are gone from Gymix. Your gym still has your membership and payment records.
        </p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 font-semibold text-ink shadow-[0_10px_30px_-8px_rgb(200_241_53/0.6)] transition active:scale-[0.97] hover:brightness-105">
          Back to Gymix
        </Link>
      </div>
    </main>
  );
}
