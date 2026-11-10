import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { CtaButtons, FaqList, FinalCta, MarketingFooter, MarketingNav, PricingCard } from "@/components/marketing";
import { BeforeAfter, DayTimeline, GlowField, LeakCalculator, Marquee, Reveal, TapDemo } from "@/components/landing-interactive";
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
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />

      {/* 1 · Hero: you don't read about check-in, you do it */}
      <GlowField className="overflow-hidden bg-ink text-white">
        <div aria-hidden className="lx-grid absolute inset-0" />
        <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div>
            <p className="lx-rise inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold tracking-widest text-brand uppercase ring-1 ring-white/10">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Built for gyms in Lebanon
            </p>
            <h1 className="lx-rise mt-6 text-5xl leading-[0.95] font-black tracking-tight sm:text-7xl" style={{ animationDelay: "80ms" }}>
              Your gym,
              <br />
              <span className="lx-shine font-serif italic">running itself.</span>
            </h1>
            <p className="lx-rise mt-6 max-w-xl text-lg text-white/70" style={{ animationDelay: "160ms" }}>
              Members tap in with their phone. Unpaid ones are stopped at the door. Payments in dollars or lira, programs in their pocket, and your whole gym on one
              screen. {formatPrice(priceUsd)} a month.
            </p>
            <div className="lx-rise mt-8" style={{ animationDelay: "240ms" }}>
              <CtaButtons />
            </div>
            <Link
              href="/demo"
              className="lx-rise mt-5 inline-flex items-center gap-2 text-base font-semibold text-brand hover:text-white"
              style={{ animationDelay: "320ms" }}
            >
              <MousePointerClick className="size-5" /> Or run a sample gym right now, no sign-up
            </Link>
          </div>
          <div className="lx-rise" style={{ animationDelay: "200ms" }}>
            <p className="mb-4 text-center text-sm font-semibold tracking-widest text-white/50 uppercase">Go on, try it ↓</p>
            <TapDemo />
          </div>
        </section>
        <div className="relative border-t border-white/10 py-5">
          <Marquee items={["Beirut", "Jounieh", "Zalka", "Jbeil", "Zahle", "Tripoli", "Saida", "Achrafieh", "Hamra", "Dbayeh", "Tyre", "Baabda"]} />
        </div>
      </GlowField>

      {/* 2 · The leak: the owner does the maths on their own gym */}
      <section id="features" className="scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-widest text-ink/50 uppercase">The receipt nobody prints</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">What is your gym leaking every month?</h2>
            <p className="mt-4 text-lg text-ink/60">Move the sliders to your gym. The receipt prints itself.</p>
          </Reveal>
          <Reveal delay={100}>
            <LeakCalculator priceUsd={priceUsd} />
          </Reveal>
        </div>
      </section>

      {/* 3 · Without / with */}
      <section className="bg-white px-4 py-20 md:py-28">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Flip the switch.</h2>
          <p className="mt-4 text-lg text-ink/60">Same gym, same members, same day.</p>
        </Reveal>
        <Reveal delay={100}>
          <BeforeAfter />
        </Reveal>
      </section>

      {/* 4 · 24 hours with Gymix */}
      <section id="how" className="scroll-mt-20 overflow-hidden bg-ink px-4 py-20 text-white md:py-28">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">24 hours at your gym</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">It works while you sleep.</h2>
        </Reveal>
        <DayTimeline />
        <Reveal className="mt-16 text-center">
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-4 text-lg font-bold text-ink transition hover:scale-[1.03] hover:bg-brand-strong">
            Run this day yourself <ArrowRight className="size-5" />
          </Link>
          <p className="mt-3 text-sm text-white/50">A full sample gym with a guide on every page. No sign-up.</p>
        </Reveal>
      </section>

      {/* 5 · Price, FAQ, close */}
      <section id="pricing" className="scroll-mt-20 px-4 py-20 md:py-28">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            One price. <span className="lx-shine-dark font-serif italic">The whole gym.</span>
          </h2>
          <p className="mt-4 text-lg text-ink/60">
            {formatPrice(priceUsd)} a month · unlimited members and staff · {trialDays} days free, no card.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <PricingCard />
        </Reveal>
      </section>
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          <FaqList />
        </div>
      </section>
      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
