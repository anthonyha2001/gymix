import Link from "next/link";
import type { ReactNode } from "react";
import { RANGES } from "./data";

// Server-safe pieces shared by the control room screens: the page heading,
// the period switch, and the dark table classes.

export function RoomHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="room-head">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-white/50">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function RangeSwitch({ base, days }: { base: string; days: number }) {
  return (
    <nav aria-label="Period" className="inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`${base}?range=${r}`}
          scroll={false}
          replace
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${r === days ? "bg-white text-ink shadow" : "text-white/55 hover:text-white"}`}
        >
          {r} days
        </Link>
      ))}
    </nav>
  );
}

export const th = "px-4 py-3 font-semibold";
export const td = "px-4 py-3 align-top";
export const thead = "sticky top-0 z-[1] bg-[#0d1219] text-left text-[11px] tracking-[0.12em] text-white/40 uppercase";
export const tbody = "room-rows divide-y divide-white/[0.05]";
export const row = "transition-colors hover:bg-white/[0.025]";

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "none"; children: ReactNode }) {
  const c = {
    good: "bg-emerald-400/10 text-emerald-300",
    warn: "bg-amber-400/10 text-amber-300",
    bad: "bg-rose-400/10 text-rose-300",
    info: "bg-sky-400/10 text-sky-300",
    none: "bg-white/[0.06] text-white/60",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${c}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-white/40">{children}</p>;
}
