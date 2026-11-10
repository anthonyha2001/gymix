import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaButtons, FaqList, MarketingFooter, MarketingNav, PricingCard } from "@/components/marketing";
import { HeroLaptop, Reveal, Story } from "@/components/landing-interactive";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";

export async function generateMetadata(): Promise<Metadata> {
  const { priceUsd, trialDays } = await getPricing();
  return {
    title: { absolute: "Gymix · The operating system for your gym" },
    description: `Memberships, payments in dollars and lira, tap-to-check-in, trainer programs and a member app. ${formatPrice(priceUsd)} a month. ${trialDays} days free.`,
  };
}

export default async function Home() {
  const { priceUsd, trialDays } = await getPricing();
  const price = formatPrice(priceUsd);
  return (
    <div className="flex flex-1 flex-col bg-ink text-white">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-10 md:pt-28">
        <div aria-hidden className="lx-aura absolute inset-x-0 top-0 h-[900px]" />
        <div className="relative mx-auto max-w-5xl px-4 text-center">
          <p className="lx-rise text-sm font-semibold tracking-[0.25em] text-brand uppercase">Built for gyms in Lebanon</p>
          <h1 className="lx-rise mt-6 text-5xl leading-[0.95] font-black tracking-[-0.045em] sm:text-7xl md:text-8xl" style={{ animationDelay: "100ms" }}>
            Your gym,
            <br />
            <span className="font-serif font-bold italic text-brand">running itself.</span>
          </h1>
          <p className="lx-rise mx-auto mt-7 max-w-2xl text-lg text-white/60 sm:text-xl" style={{ animationDelay: "200ms" }}>
            Memberships, payments in dollars and lira, tap-to-check-in and an app your members open every day. One system for the whole gym.
          </p>
          <div className="lx-rise mt-10 flex justify-center" style={{ animationDelay: "300ms" }}>
            <CtaButtons />
          </div>
          <p className="lx-rise mt-4 text-sm text-white/40" style={{ animationDelay: "380ms" }}>
            {price} a month · {trialDays} days free · no card
          </p>
        </div>
        <div className="relative mt-20">
          <HeroLaptop />
        </div>
      </section>

      {/* The story */}
      <section id="features" className="scroll-mt-20">
        <Reveal className="mx-auto max-w-3xl px-4 pt-24 text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-6xl">Everything your front desk does.</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/55">Without the notebook, the calculator or forty WhatsApp chats.</p>
        </Reveal>
        <Story />
      </section>

      {/* Facts */}
      <section id="how" className="scroll-mt-20 border-y border-white/10 px-4 py-24">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [price, "a month, for the whole gym"],
            ["$1", "the only hardware: a sticker"],
            ["10 min", "to set up your gym"],
            ["0", "apps to install for members"],
          ].map(([n, l], i) => (
            <Reveal key={l} delay={i * 90} className="bg-ink p-8 sm:p-10">
              <p className="text-5xl font-black tracking-tight text-white sm:text-6xl">{n}</p>
              <p className="mt-3 text-white/55">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Demo invitation */}
      <section className="px-4 py-28 text-center">
        <Reveal>
          <p className="text-sm font-semibold tracking-[0.25em] text-brand uppercase">See it for yourself</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Run a gym for a day. Before you decide anything.</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/55">A full sample gym with members, payments and classes, and a guide on every page. No sign-up.</p>
          <Link
            href="/demo"
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-4 text-lg font-semibold transition hover:border-brand hover:text-brand"
          >
            Open the live demo <ArrowRight className="size-5" />
          </Link>
        </Reveal>
      </section>

      {/* Pricing + FAQ (light) */}
      <div className="bg-canvas text-ink">
        <section id="pricing" className="scroll-mt-20 px-4 py-24 md:py-32">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-4xl font-black tracking-tight sm:text-6xl">One price. The whole gym.</h2>
            <p className="mt-5 text-lg text-ink/60">
              {price} a month · unlimited members and staff · {trialDays} days free, no card.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <PricingCard />
          </Reveal>
        </section>
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-3xl">
            <FaqList />
          </div>
        </section>
      </div>

      {/* Close */}
      <section className="relative overflow-hidden px-4 py-32 text-center">
        <div aria-hidden className="lx-aura absolute inset-0" />
        <Reveal className="relative">
          <h2 className="mx-auto max-w-3xl text-5xl leading-[0.95] font-black tracking-[-0.04em] sm:text-7xl">
            Your gym,
            <br />
            <span className="font-serif font-bold italic text-brand">running itself.</span>
          </h2>
          <div className="mt-12 flex justify-center">
            <CtaButtons />
          </div>
        </Reveal>
      </section>
      <MarketingFooter />
    </div>
  );
}
