import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FinalCta, MarketingFooter, MarketingNav } from "@/components/marketing";
import { Reveal } from "@/components/landing-interactive";
import { FEATURE_COUNT, FEATURE_GROUPS } from "@/lib/feature-catalog";

export const metadata: Metadata = {
  title: "Features",
  description: `Every Gymix feature: ${FEATURE_COUNT} things your gym gets, from tap check-in and billing in dollars and lira to door access, programs, challenges and the member app.`,
};

export default function FeaturesPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />

      <section className="relative overflow-hidden bg-ink px-4 pt-16 pb-20 text-center text-white">
        <div aria-hidden className="absolute top-0 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Features</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Everything Gymix does.</h1>
          <p className="mt-4 text-lg text-white/70">
            All {FEATURE_COUNT} features in {FEATURE_GROUPS.length} areas. Every one is included in the same price, for every gym.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-ink hover:bg-brand-strong">
              Try the live demo <ArrowRight className="size-4" />
            </Link>
            <Link href="/pricing" className="inline-flex h-12 items-center rounded-xl px-6 font-semibold text-white ring-1 ring-white/20 hover:bg-white/10">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Jump to an area. */}
      <nav aria-label="Feature areas" className="sticky top-16 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {FEATURE_GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-ink/70 hover:border-ink/30 hover:text-ink"
            >
              {g.title}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24">
        {FEATURE_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-32 border-b border-line py-14 last:border-b-0">
            <Reveal className="mb-8 max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {g.title} <span className="ml-1 align-middle text-sm font-semibold text-muted">{g.items.length}</span>
              </h2>
              <p className="mt-2 text-ink/60">{g.intro}</p>
            </Reveal>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((f) => (
                <li key={f.name} className="rounded-2xl border border-line bg-surface p-5">
                  <h3 className="flex items-start gap-2.5 font-semibold leading-snug">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-strong" aria-hidden />
                    {f.name}
                  </h3>
                  <p className="mt-1.5 pl-4 text-[15px] leading-relaxed text-ink/65">{f.text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
