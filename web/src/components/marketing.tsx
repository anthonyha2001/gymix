import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LifeBuoy,
  Lock,
  MessageCircle,
  Nfc,
  PauseCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { PLAN_FEATURES, formatPrice, type Pricing } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";

// Shared pieces of the public site (landing page and /pricing).

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/85 text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Gymix home">
          <Logo className="text-lg" />
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-1 text-sm text-white/70 md:flex">
          <Link href="/features" className="rounded-lg px-3 py-2 hover:text-white">Features</Link>
          <Link href="/demo" className="rounded-lg px-3 py-2 hover:text-white">Live demo</Link>
          <Link href="/#how" className="rounded-lg px-3 py-2 hover:text-white">How it works</Link>
          <Link href="/pricing" className="rounded-lg px-3 py-2 hover:text-white">Pricing</Link>
          <Link href="/pricing#faq" className="rounded-lg px-3 py-2 hover:text-white">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white">
            Log in
          </Link>
          <Link href="/request" className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold whitespace-pre text-ink hover:bg-brand-strong">
            Request<span className="hidden sm:inline"> access</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function CtaButtons({ dark = true }: { dark?: boolean }) {
  const { priceUsd, trialDays } = await getPricing();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/request" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-ink shadow-[0_8px_30px_-8px_rgba(200,241,53,0.6)] transition hover:-translate-y-0.5 hover:bg-brand-strong">
        Request access <ArrowRight className="size-4" />
      </Link>
      <Link
        href="/pricing"
        className={`inline-flex h-12 items-center rounded-xl px-6 text-base font-semibold ring-1 transition ${
          dark ? "text-white ring-white/20 hover:bg-white/10" : "text-ink ring-ink/15 hover:bg-ink/5"
        }`}
      >
        {formatPrice(priceUsd)} a month, all in
      </Link>
    </div>
  );
}

// The hero's product picture, drawn in HTML so it is always crisp and current.
export function HeroMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[520px] select-none">
      <div className="absolute -inset-10 rounded-full bg-brand/20 blur-3xl" />
      {/* Dashboard card */}
      <div className="relative rounded-2xl border border-white/10 bg-[#161b22] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Today at Iron House</p>
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">Live</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { k: "Check-ins", v: "126" },
            { k: "Collected", v: "$1,840" },
            { k: "Active", v: "412" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-white/5 p-3">
              <p className="text-[11px] text-white/50">{s.k}</p>
              <p className="mt-1 text-lg font-bold text-white tabular-nums">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {[38, 52, 44, 63, 58, 71, 66, 80, 74, 92, 85, 100].map((h, i) => (
            <span key={i} className="flex-1 rounded-t-[4px] bg-gradient-to-t from-brand/40 to-brand" style={{ height: `${h}%` }} />
          ))}
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {[
            { n: "Rami Haddad", t: "Tapped in", c: "text-brand" },
            { n: "Lara Nassar", t: "Paid $45 in lira", c: "text-white/60" },
            { n: "Karim Saad", t: "Account frozen: unpaid", c: "text-[#ff8a80]" },
          ].map((r) => (
            <li key={r.n} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="text-white/90">{r.n}</span>
              <span className={`text-xs ${r.c}`}>{r.t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Phone */}
      <div className="absolute -bottom-16 -right-2 w-[190px] rotate-[4deg] rounded-[2rem] border-[6px] border-[#2a2f36] bg-canvas p-2.5 shadow-2xl sm:-right-8 sm:w-[210px]">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#2a2f36]" />
        <div className="rounded-2xl bg-ink p-3 text-white">
          <p className="text-[10px] text-white/60">Membership</p>
          <p className="text-sm font-bold">Monthly</p>
          <div className="mt-2 flex justify-between text-[10px]">
            <span className="text-white/60">Days left</span>
            <span className="font-bold text-brand">23</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-success p-3 text-white">
          <Nfc className="size-5 shrink-0" />
          <div>
            <p className="text-[11px] font-bold leading-tight">Checked in</p>
            <p className="text-[10px] opacity-80">Welcome back, Nour</p>
          </div>
        </div>
        <div className="mt-2 rounded-2xl bg-surface p-3">
          <p className="text-[10px] text-muted">Leg Press · last time</p>
          <p className="text-sm font-bold text-ink">80 kg × 10</p>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-surface p-1.5">
          {[Dumbbell, CalendarDays, TrendingUp, MessageCircle].map((Icon, i) => (
            <span key={i} className={`grid h-6 place-items-center rounded-lg ${i === 0 ? "bg-brand" : ""}`}>
              <Icon className="size-3 text-ink" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FEATURES = [
  { icon: Users, title: "Members & memberships", body: "Sell monthly, yearly or visit packs. Renewals, freezes and expiry handled for you." },
  { icon: CreditCard, title: "Dollars and lira", body: "Invoices in USD, payments in cash, card, Whish or OMT, with your own lira rate." },
  { icon: Nfc, title: "Tap to check in", body: "A $1 NFC sticker at the door. Members tap their phone and walk in. No hardware to buy." },
  { icon: Smartphone, title: "A member app", body: "Installs from a link on iPhone and Android. Their membership, programs, classes and progress." },
  { icon: ClipboardList, title: "Programs from your trainers", body: "Members ask, your trainers build the program on the machines you actually have. Or members build their own." },
  { icon: Dumbbell, title: "Workouts they come back for", body: "Today's workout on their home screen, weekly goals, streaks and personal records with confetti. Shake the phone to open it." },
  { icon: CalendarDays, title: "Calendar and classes", body: "A day, week and month calendar, bookings, waitlists, personal training and monthly courses like Pilates." },
  { icon: QrCode, title: "Machines that teach", body: "A sticker on every machine shows how to use it and the member's last weights." },
  { icon: Lock, title: "Unpaid? Frozen.", body: "Members who don't pay, or whose membership ended, only see their home page until they renew. Unfrozen at their next tap." },
  { icon: PauseCircle, title: "Members pause themselves", body: "Travelling or injured? Members pause their membership from the app and the days are added back." },
  { icon: MessageCircle, title: "WhatsApp, automatically", body: "Renewal reminders days before expiry, payment receipts and login links for new members, plus class and training-day reminders in the app." },
  { icon: ShieldCheck, title: "Roles for your team", body: "Owner, manager, front desk and trainers each see exactly what they need." },
  { icon: TrendingUp, title: "Numbers that matter", body: "Today's check-ins, money collected, who owes and who is about to leave." },
  { icon: LifeBuoy, title: "Help when you need it", body: "Stuck? Gymix support can open your dashboard and fix it with you. Nothing to set up." },
] as const;

export async function PricingCard() {
  const { priceUsd, trialDays } = await getPricing();
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-px rounded-[28px] bg-gradient-to-b from-brand to-brand/0" />
      <div className="relative rounded-[27px] bg-surface p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">Gymix</p>
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-ink">{trialDays} days free</span>
        </div>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="text-6xl font-bold tracking-tight text-ink">{formatPrice(priceUsd)}</span>
          <span className="text-muted">/ month</span>
        </p>
        <p className="mt-2 text-sm text-muted">Per gym. Not per member, not per staff. Everything included.</p>
        <Link href="/request" className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-base font-semibold text-white transition hover:bg-ink/90">
          Request access <ArrowRight className="size-4" />
        </Link>
        <p className="mt-2 text-center text-xs text-muted">No card needed. Pay by Whish, OMT or bank transfer when the trial ends.</p>
        <ul className="mt-6 space-y-3 border-t border-line pt-6 text-sm">
          {PLAN_FEATURES.map((f) => (
            <li key={f} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand">
                <Check className="size-3 text-ink" strokeWidth={3} />
              </span>
              <span className="text-ink">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const faq = ({ priceUsd, trialDays }: Pricing) => [
  {
    q: "Do my members need to download an app?",
    a: "No store download. Gymix sends each member a personal link on WhatsApp, from our number or your own; it opens their app straight away and can be added to their home screen like any other app, on iPhone and Android.",
  },
  {
    q: "What do I need to buy for check-in?",
    a: "Nothing but a few NFC stickers (about $1 each). Write the check-in link onto one from your phone and stick it at the entrance. Members without NFC scan the printed QR code from their app.",
  },
  {
    q: "How do I pay for Gymix?",
    a: `${formatPrice(priceUsd)} a month per gym, after a ${trialDays}-day free trial. Pay by Whish, OMT or bank transfer, for one month or several at once. No card is needed.`,
  },
  {
    q: "What happens if I stop paying?",
    a: "You get reminders first. A few days after your subscription ends the staff dashboard locks until you renew. Your data is never deleted, and your members can still use their app meanwhile.",
  },
  {
    q: "Can it handle payments in lira?",
    a: "Yes. Prices are in dollars, and the front desk can take cash in lira at your own exchange rate, which you update whenever it changes.",
  },
  {
    q: "Is my gym's data private?",
    a: "Each gym's data is separated in the database itself, not just hidden in the screens. Trainers don't see money, members only see their own records, and the Gymix console only shows totals, never your members' details.",
  },
  {
    q: "How long does it take to set up?",
    a: "About ten minutes: create your gym, add your membership plans, invite your staff, and start adding members as they walk in.",
  },
] as const;

export async function FaqList() {
  const items = faq(await getPricing());
  return (
    <div className="divide-y divide-line rounded-3xl border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
            {f.q}
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-lg leading-none transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export async function FinalCta() {
  const { trialDays } = await getPricing();
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-brand px-6 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-5xl">Your gym, running itself.</h2>
        <p className="mx-auto mt-4 max-w-xl text-ink/70">
          Try every feature free for {trialDays} days. If it doesn&apos;t save you time in the first week, don&apos;t pay.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/request" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-base font-semibold text-white transition hover:-translate-y-0.5">
            Set up your gym <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
        <span className="flex items-center gap-3">
          <Logo />
          <span>The operating system for gyms in Lebanon.</span>
        </span>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/features" className="hover:text-ink">Features</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/login" className="hover:text-ink">Log in</Link>
          <Link href="/request" className="hover:text-ink">Request access</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
