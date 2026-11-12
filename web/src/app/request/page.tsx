import type { Metadata } from "next";
import { CreditCard, KeyRound, MessageCircle } from "lucide-react";
import { MarketingNav } from "@/components/marketing";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import { RequestForm } from "./request-form";

export const metadata: Metadata = {
  title: "Request access",
  description: "Ask for Gymix for your gym. We'll reach you on WhatsApp, set you up, and send your login.",
};

// New gyms ask for Gymix here. The request lands in the super admin's control
// room (Clients), who follows up on WhatsApp.
export default async function RequestPage() {
  const { priceUsd } = await getPricing();
  const steps = [
    { icon: MessageCircle, t: "Tell us about your gym", d: "Two minutes. No card, no commitment." },
    { icon: CreditCard, t: "We message you on WhatsApp", d: `How to pay ${formatPrice(priceUsd)} a month: Whish, OMT, transfer or cash.` },
    { icon: KeyRound, t: "Get your login", d: "Your gym is ready the moment you've paid. We help you set it up." },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <MarketingNav />
      <main className="relative flex-1 overflow-hidden">
        <span aria-hidden className="challenge-glow" />
        <span aria-hidden className="challenge-grid" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:py-20 lg:grid-cols-[1fr_28rem] lg:items-start">
          <div className="page-enter">
            <p className="text-xs font-semibold tracking-[0.32em] text-brand uppercase">Request access</p>
            <h1 className="mt-5 text-4xl leading-[1.04] font-extrabold tracking-tight sm:text-6xl">
              Bring Gymix <span className="text-brand">to your gym.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">We set up every gym ourselves, so nothing goes wrong on day one.</p>
            <ol className="stagger mt-10 max-w-md space-y-4">
              {steps.map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-brand ring-1 ring-white/10">
                    <s.icon className="size-5" />
                    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand text-[10px] font-black text-ink">{i + 1}</span>
                  </span>
                  <span>
                    <span className="block font-semibold">{s.t}</span>
                    <span className="block text-sm text-white/55">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <RequestForm />
        </div>
      </main>
    </div>
  );
}
