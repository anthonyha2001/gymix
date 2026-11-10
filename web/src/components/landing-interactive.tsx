"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

// The interactive pieces of the landing page: a sticker you can tap, a calculator
// that prints your gym's real monthly leak, scroll reveals and a cursor glow.

// ---------------------------------------------------------------- reveal on scroll
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("lx-in");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lx-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- cursor glow
export function GlowField({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.setProperty("--gx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }}
    >
      <div aria-hidden className="lx-glow pointer-events-none absolute inset-0" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- tap the sticker
type Screen = "idle" | "checking" | "in" | "out";

export function TapDemo() {
  const [who, setWho] = useState<"paid" | "unpaid">("paid");
  const [screen, setScreen] = useState<Screen>("idle");
  const [taps, setTaps] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function tap() {
    if (timer.current) clearTimeout(timer.current);
    setTaps((n) => n + 1);
    setScreen("checking");
    timer.current = setTimeout(() => setScreen(who === "paid" ? "in" : "out"), 650);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* who's tapping */}
      <div className="mb-6 flex justify-center gap-2" role="radiogroup" aria-label="Try as">
        {(["paid", "unpaid"] as const).map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={who === w}
            onClick={() => {
              setWho(w);
              setScreen("idle");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              who === w ? "bg-brand text-ink" : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
          >
            {w === "paid" ? "Member who paid" : "Member who didn't"}
          </button>
        ))}
      </div>

      <div className="relative flex items-center justify-center gap-6">
        {/* the sticker */}
        <button
          type="button"
          onClick={tap}
          aria-label="Tap the Gymix sticker"
          className="group relative grid size-28 shrink-0 place-items-center rounded-[28px] bg-brand shadow-[0_0_60px_rgb(200_241_53/0.45)] transition active:scale-95 sm:size-32"
        >
          <span key={taps} aria-hidden className="lx-ripple absolute inset-0 rounded-[28px]" />
          <span key={`b${taps}`} aria-hidden className="lx-ripple lx-ripple-2 absolute inset-0 rounded-[28px]" />
          <LogoMark className="size-24 text-ink transition group-hover:scale-105 sm:size-28" />
          <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tracking-widest text-white/60 uppercase">
            {taps ? "Tap again" : "Tap me"}
          </span>
        </button>

        {/* the phone: same screens as the real app */}
        <div className="relative h-[380px] w-[200px] shrink-0 rounded-[38px] bg-[#05070a] p-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:h-[420px] sm:w-[220px]">
          <div className="absolute top-3 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rounded-full bg-[#05070a]" />
          <div
            className={`relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[30px] px-4 text-center text-white transition-colors duration-300 ${
              screen === "in" ? "bg-success" : screen === "out" ? "bg-danger" : "bg-gradient-to-b from-[#1b2330] to-[#0b0f15]"
            }`}
          >
            {screen === "idle" && (
              <>
                <LogoMark className="size-12 text-brand" />
                <p className="text-sm font-semibold text-white/80">Waiting for a tap…</p>
              </>
            )}
            {screen === "checking" && (
              <>
                <Loader2 className="size-10 animate-spin" />
                <p className="text-base font-semibold">Checking you in…</p>
              </>
            )}
            {screen === "in" && (
              <div className="lx-pop flex flex-col items-center gap-2">
                <CheckCircle2 className="size-12" />
                <p className="text-[10px] font-medium tracking-widest uppercase opacity-80">Checked in</p>
                <p className="text-2xl leading-tight font-bold">Welcome back, Karim</p>
                <p className="text-xs opacity-90">Monthly · until 29 Nov</p>
                <span className="mt-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-ink">Start training</span>
              </div>
            )}
            {screen === "out" && (
              <div className="lx-pop lx-shake flex flex-col items-center gap-2">
                <XCircle className="size-12" />
                <p className="text-xl font-bold">Not allowed in</p>
                <p className="text-sm font-medium">Fadi Germanos</p>
                <p className="text-xs leading-snug opacity-90">Account frozen: unpaid balance of $25.00. Please see the front desk.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-14 text-center text-sm text-white/55">
        {screen === "out"
          ? "No speech at the desk. The door already knows."
          : screen === "in"
            ? "That's the whole check-in. One tap, on a $1 sticker."
            : "This is the real check-in screen your members see."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- the leak calculator
function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink/70">{label}</span>
        <span className="text-lg font-bold tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lx-range mt-2 w-full"
        style={{ "--p": `${pct}%` } as React.CSSProperties}
      />
    </label>
  );
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function LeakCalculator({ priceUsd }: { priceUsd: number }) {
  const [members, setMembers] = useState(80);
  const [fee, setFee] = useState(45);
  const [late, setLate] = useState(15);

  // Conservative assumptions, stated on the receipt.
  const lines = [
    { l: `"I'll pay next week" (${late}% of members)`, v: members * (late / 100) * fee * 0.35 },
    { l: "Expired, still training", v: members * 0.03 * fee },
    { l: "Wrong lira rate & rounding", v: members * fee * 0.012 },
    { l: "Cash nobody wrote down", v: members * fee * 0.01 },
  ];
  const monthly = lines.reduce((s, x) => s + x.v, 0);
  const hours = Math.round(members * (late / 100) * 0.6 + members * 0.04);
  const times = monthly / priceUsd;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div className="space-y-7 rounded-3xl bg-white p-6 shadow-[0_30px_80px_-30px_rgb(13_17_23/0.35)] ring-1 ring-ink/5 sm:p-8">
        <Slider label="Members" value={members} min={20} max={500} step={5} onChange={setMembers} format={(v) => String(v)} />
        <Slider label="Monthly fee" value={fee} min={15} max={120} step={1} onChange={setFee} format={(v) => `$${v}`} />
        <Slider label="Members who pay late" value={late} min={0} max={50} step={1} onChange={setLate} format={(v) => `${v}%`} />
        <p className="text-xs leading-relaxed text-ink/50">
          An estimate with cautious assumptions: a third of late payments slip a whole month, 3% of members train after expiring, about 2% lost to rates and
          unrecorded cash. Your numbers may be higher.
        </p>
      </div>

      {/* the receipt */}
      <div className="lx-receipt relative mx-auto w-full max-w-md bg-[#f6f3ea] px-7 pt-10 pb-8 font-mono text-[#1a1a1a] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.55)]">
        <p className="text-center text-base font-bold tracking-[0.18em]">YOUR GYM</p>
        <p className="text-center text-xs text-[#6a665d]">What it quietly loses · every month</p>
        <div className="my-4 border-t-2 border-dashed border-[#a7a296]" />
        <ul className="space-y-2 text-sm">
          {lines.map((x) => (
            <li key={x.l} className="flex items-baseline gap-2">
              <span className="min-w-0">{x.l}</span>
              <span className="flex-1 translate-y-[-3px] border-b-2 border-dotted border-[#b1ac9f]" />
              <span key={Math.round(x.v)} className="lx-tick font-bold tabular-nums">{usd(x.v)}</span>
            </li>
          ))}
          <li className="flex items-baseline gap-2">
            <span>Hours chasing &amp; checking</span>
            <span className="flex-1 translate-y-[-3px] border-b-2 border-dotted border-[#b1ac9f]" />
            <span key={hours} className="lx-tick font-bold tabular-nums">{hours} h</span>
          </li>
        </ul>
        <div className="my-4 border-t-2 border-dashed border-[#a7a296]" />
        <div className="flex items-baseline justify-between text-2xl font-bold">
          <span>TOTAL</span>
          <span key={Math.round(monthly)} className="lx-tick text-danger tabular-nums">{usd(monthly)}</span>
        </div>
        <p className="mt-1 text-right text-sm text-[#6a665d]">
          = <b key={Math.round(monthly * 12)} className="lx-tick text-[#1a1a1a]">{usd(monthly * 12)}</b> a year
        </p>
        <div className="my-4 border-t-2 border-dashed border-[#a7a296]" />
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 font-sans text-white">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-lg bg-brand">
              <LogoMark className="size-6 text-ink" />
            </span>
            Gymix
          </span>
          <span className="text-sm">
            ${priceUsd.toFixed(2)}/mo ·{" "}
            <b className="text-brand">{times >= 1 ? `pays for itself ${times.toFixed(times >= 10 ? 0 : 1)}×` : "already worth it"}</b>
          </span>
        </div>
        <p className="mt-4 text-center text-[11px] tracking-wider text-[#6a665d]">*** THANK YOU FOR NOT HAVING A SYSTEM ***</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 24 hours with Gymix
const DAY = [
  { t: "06:58", title: "The first member taps in.", body: "You're still asleep. The sticker at the door checks them in, and refuses anyone who didn't pay.", tag: "Tap check-in" },
  { t: "09:30", title: "Paid in lira. Maths done.", body: "Front desk takes cash in dollars or lira at your rate, or Whish and OMT. The invoice updates itself.", tag: "Dollars + lira" },
  { t: "13:00", title: "Three days late? Frozen.", body: "Unpaid members freeze automatically and their app shows what they owe. Nobody has to say a word.", tag: "Auto-freeze" },
  { t: "17:45", title: "Spinning is full.", body: "Members book classes from their phone. You see who's coming before they arrive.", tag: "Classes" },
  { t: "19:10", title: "Karim breaks a personal record.", body: "His trainer's program is in his pocket. Confetti on his phone, a streak he won't want to lose.", tag: "Member app" },
  { t: "23:59", title: "You check one screen.", body: "Who came, who paid, who owes, who's ending this week. Then you go to bed.", tag: "Your dashboard" },
];

export function DayTimeline() {
  return (
    <ol className="relative mx-auto max-w-3xl">
      <span aria-hidden className="absolute top-2 bottom-2 left-[27px] w-px bg-gradient-to-b from-brand via-white/20 to-transparent sm:left-[39px]" />
      {DAY.map((d, i) => (
        <li key={d.t} className="relative pb-12 pl-16 last:pb-0 sm:pl-24">
          <Reveal delay={i * 40}>
            <span className="absolute top-1 left-0 grid size-14 place-items-center rounded-2xl bg-ink font-mono text-xs font-bold text-brand ring-1 ring-white/10 sm:size-20 sm:text-base">
              {d.t}
            </span>
            <span className="inline-flex rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">{d.tag}</span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{d.title}</h3>
            <p className="mt-2 max-w-xl text-white/65">{d.body}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- the "vs" toggle
export function BeforeAfter() {
  const [on, setOn] = useState(true);
  const rows = [
    ["A notebook, three handwritings", "Every payment on record"],
    ["\"Kam el sa3er lyom?\" ×10 a day", "Your rate, set once"],
    ["Chasing people on WhatsApp", "Unpaid? Frozen automatically"],
    ["Who's expired? No idea", "Ending this week: one list"],
    ["Programs as blurry PDFs", "Programs in their app"],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mx-auto mb-8 flex w-fit items-center gap-1 rounded-full bg-ink/5 p-1.5">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setOn(v)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${on === v ? (v ? "bg-brand text-ink shadow" : "bg-ink text-white shadow") : "text-ink/60"}`}
          >
            {v ? "With Gymix" : "Without"}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {rows.map(([a, b], i) => (
          <li
            key={a}
            className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-lg font-semibold transition-all duration-500 ${on ? "bg-white shadow-sm ring-1 ring-ink/5" : "bg-ink/[0.04] text-ink/60"}`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-full transition ${on ? "bg-brand text-ink" : "bg-danger/10 text-danger"}`}>
              {on ? <Check className="size-4" /> : <XCircle className="size-4" />}
            </span>
            <span className="relative">
              <span className={`block transition-all duration-500 ${on ? "translate-y-2 opacity-0 blur-sm" : ""}`}>{a}</span>
              <span className={`absolute inset-0 transition-all duration-500 ${on ? "" : "-translate-y-2 opacity-0 blur-sm"}`}>{b}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- marquee
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="lx-marquee flex w-max gap-10 py-1">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 text-lg font-semibold whitespace-nowrap text-white/50">
            {t}
            <span className="size-1.5 rounded-full bg-brand" />
          </span>
        ))}
      </div>
    </div>
  );
}
