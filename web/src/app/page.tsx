import type { Metadata } from "next";
import { Nfc, Send, Store } from "lucide-react";
import {
  CtaButtons,
  FEATURES,
  FaqList,
  FinalCta,
  HeroMock,
  MarketingFooter,
  MarketingNav,
  PricingCard,
} from "@/components/marketing";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";

export async function generateMetadata(): Promise<Metadata> {
  const { priceUsd, trialDays } = await getPricing();
  return {
    title: { absolute: "Gymix · The operating system for your gym" },
    description: `Memberships, payments in dollars and lira, tap-to-check-in, trainer programs and a member app. ${formatPrice(priceUsd)} a month. ${trialDays} days free.`,
  };
}

const STEPS = [
  { icon: Store, title: "Create your gym", body: "Add your membership plans, prices and lira rate. Invite your managers, front desk and trainers." },
  { icon: Send, title: "Invite members on WhatsApp", body: "Each member gets a personal link. One tap and they're in their app, no password to remember." },
  { icon: Nfc, title: "They tap in", body: "A sticker at the door checks them in. Unpaid? They're stopped and sent to the front desk." },
];

export default async function Home() {
  const { priceUsd, trialDays } = await getPricing();
  const price = formatPrice(priceUsd);
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-16 pb-28 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:pb-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="size-1.5 rounded-full bg-brand" /> Built for gyms in Lebanon
            </p>
            <h1 className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Run your gym.
              <br />
              <span className="text-brand">Keep them coming back.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Gymix is the all-in-one system for your gym: memberships, payments in dollars and lira, tap-to-check-in,
              programs from your trainers and an app your members actually open.
            </p>
            <div className="mt-8">
              <CtaButtons />
            </div>
            <p className="mt-4 text-sm text-white/50">No card needed. Set up in ten minutes.</p>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center md:grid-cols-4">
          {[
            { k: price, v: "a month for the whole gym" },
            { k: "USD + LBP", v: "with your own lira rate" },
            { k: "$1", v: "NFC sticker is all the hardware" },
            { k: "10 min", v: "to set up your gym" },
          ].map((s) => (
            <div key={s.v}>
              <p className="text-2xl font-bold tracking-tight">{s.k}</p>
              <p className="mt-1 text-sm text-muted">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-strong">Everything in one place</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Replace the notebook, the spreadsheet and the WhatsApp groups.</h2>
            <p className="mt-4 text-lg text-muted">One system for the front desk, your trainers, your dietitian and every member.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="grid size-11 place-items-center rounded-2xl bg-ink text-brand transition group-hover:bg-brand group-hover:text-ink">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-ink px-4 py-20 text-white md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Up and running before your next shift.</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <span className="text-sm font-semibold text-white/40">Step {i + 1}</span>
                <span className="mt-4 grid size-12 place-items-center rounded-2xl bg-brand text-ink">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-strong">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One price. Everything included.</h2>
            <p className="mt-4 text-lg text-muted">
              {price} a month for your whole gym: every member, every trainer, every feature. Less than one member&apos;s monthly fee.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                ["No setup fee", "Create your gym and start today."],
                [`${trialDays} days free`, "Try everything with your real members before paying."],
                ["Pay your way", "Whish, OMT or bank transfer. Monthly, or several months at once."],
                ["No lock-in", "Stop whenever you like. Your data stays yours."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-strong" />
                  <span>
                    <span className="block font-semibold">{t}</span>
                    <span className="text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <PricingCard />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Questions gym owners ask</h2>
          <div className="mt-10">
            <FaqList />
          </div>
        </div>
      </section>

      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
