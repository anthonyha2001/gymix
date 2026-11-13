import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing-interactive";
import { FEATURE_COUNT } from "@/lib/feature-catalog";

// Every Gymix feature, grouped, for the landing page.
const GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Members & memberships",
    items: [
      "Member profiles with phone, notes and history",
      "Monthly, yearly, multi-month and visit-pack plans",
      "Renew, sell, freeze and resume in one click",
      "Who's active, expiring this week, expired or owing",
      "Members pause their own membership when travelling",
      "Personal invite links: one tap into their app",
    ],
  },
  {
    title: "Payments & billing",
    items: [
      "Prices in dollars, payments in dollars or lira",
      "Your own lira rate, set once",
      "Cash, Whish, OMT, card and bank transfer",
      "Automatic invoices and receipts",
      "Unpaid members frozen automatically",
      "Who owes what, on one screen",
      "Refunds, voids and payment history",
    ],
  },
  {
    title: "Check-in & doors",
    items: [
      "Tap-to-check-in with a $1 NFC sticker",
      "QR code for phones without NFC",
      "Expired or unpaid? Refused at the door, with the reason",
      "Front desk check-in by name or member code",
      "Door and turnstile access (ZKTeco & Hikvision), coming soon",
      "Live count of who's inside and busy hours",
      "Self-service kiosk at the entrance",
    ],
  },
  {
    title: "Classes & training",
    items: [
      "Class schedule, bookings and waitlists",
      "Monthly courses and personal training",
      "Programs built from your real machines",
      "772 exercises, each animated in 3D",
      "Machine stickers that open a how-to and last weights",
      "Program requests from members to trainers",
    ],
  },
  {
    title: "The member app",
    items: [
      "Installed from a link, iPhone and Android, no app store",
      "Today's workout and a workout logger with rest timer",
      "Personal records, streaks and weekly goals",
      "Body measurements and progress charts",
      "Monthly challenges with a live leaderboard",
      "Book classes and chat with the gym",
      "Push notifications and reminders",
    ],
  },
  {
    title: "Your team & your gym",
    items: [
      "Roles for owner, manager, front desk and trainer",
      "Trainers never see money",
      "Automatic WhatsApp reminders and receipts",
      "Shop: sell supplements and drinks with stock",
      "Gym TV screens: classes, leaderboard, offers",
      "Overview dashboard and monthly reports",
      "Unlimited members and staff",
    ],
  },
];

export function AllFeatures() {
  return (
    <section id="all-features" className="scroll-mt-20 px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.32em] text-ink/45 uppercase">Everything included</p>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">One price. Every feature.</h2>
          <p className="mt-5 text-lg text-ink/60">No add-ons, no per-member fees. Your whole gym gets all of this.</p>
        </Reveal>
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g, i) => (
            <Reveal key={g.title} delay={(i % 3) * 120}>
              <h3 className="border-b border-ink/10 pb-3 text-lg font-bold">{g.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((x) => (
                  <li key={x} className="flex gap-3 text-[15px] leading-snug text-ink/70">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-strong" />
                    {x}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link href="/features" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 font-semibold text-white hover:bg-ink/90">
            See all {FEATURE_COUNT} features <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
