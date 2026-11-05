import type { Metadata } from "next";
import { FinalCta, MarketingFooter, MarketingNav } from "@/components/marketing";
import { DemoTour } from "./demo-tour";

export const metadata: Metadata = {
  title: "Live demo",
  description: "See Gymix in action: every feature on a phone, with what it does and how to start.",
};

export default function DemoPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />
      <section className="bg-ink px-4 pt-14 pb-10 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Live demo</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">See Gymix in 60 seconds.</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/70">
          Each feature plays on the phone. Read what it does and where to start, then set up your gym in ten minutes.
        </p>
      </section>
      <DemoTour />
      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
