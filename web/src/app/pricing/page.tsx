import type { Metadata } from "next";
import { FaqList, FinalCta, MarketingFooter, MarketingNav, PricingCard } from "@/components/marketing";
import { PRICE_USD, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Gymix is $${PRICE_USD} a month per gym, everything included, after a ${TRIAL_DAYS}-day free trial.`,
};

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />
      <section className="relative overflow-hidden bg-ink px-4 pt-16 pb-40 text-center text-white">
        <div aria-hidden className="absolute top-0 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Pricing</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing.</h1>
          <p className="mt-4 text-lg text-white/70">
            One plan with everything in it. ${PRICE_USD} a month per gym, whether you have 50 members or 2,000.
          </p>
        </div>
      </section>
      <section className="-mt-28 px-4 pb-20">
        <PricingCard />
      </section>
      <section id="faq" className="scroll-mt-20 px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
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
