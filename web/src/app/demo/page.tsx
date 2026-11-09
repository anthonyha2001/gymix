import type { Metadata } from "next";
import { CalendarDays, CreditCard, LayoutDashboard, ShoppingBag, Smartphone, Users } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { StartDemoButton } from "./start-button";

export const metadata: Metadata = {
  title: "Try the live demo",
  description: "Try Gymix with a sample gym: members, payments, classes, a shop and the member app, with a guide on every page. No sign-up.",
};

const INSIDE = [
  { icon: Users, title: "25 members", body: "Active, ending soon, expired, paused and owing money." },
  { icon: CreditCard, title: "Payments", body: "Dollars, lira, Whish, OMT and card, with invoices." },
  { icon: CalendarDays, title: "Classes", body: "A weekly schedule with bookings." },
  { icon: ShoppingBag, title: "A shop", body: "Supplements and drinks with stock and sales." },
  { icon: LayoutDashboard, title: "Every page", body: "Check-in, programs, equipment, team, settings." },
  { icon: Smartphone, title: "The member app", body: "Switch to Karim's phone at any time." },
];

export default function DemoPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <MarketingNav />
      <section className="relative overflow-hidden bg-ink px-4 pt-16 pb-20 text-center text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(200_241_53/0.16),transparent)]" />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">Live demo</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Run a gym for a day.</h1>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Get your own sample gym in the real Gymix, full of members, payments and classes. A guide shows you every page and what to try. Click
            anything, change anything.
          </p>
          <div className="mx-auto mt-8 max-w-sm">
            <StartDemoButton />
          </div>
          <p className="mt-4 text-sm text-white/50">No sign-up. Private to you, deleted after 24 hours. No messages are sent.</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight">What&apos;s inside Atlas Fitness</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INSIDE.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
