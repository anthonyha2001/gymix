import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqList, MarketingFooter, MarketingNav, PricingCard } from "@/components/marketing";
import { Reveal } from "@/components/landing-interactive";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";

export async function generateMetadata(): Promise<Metadata> {
  const { priceUsd, trialDays } = await getPricing();
  return {
    title: { absolute: "Gymix · The operating system for your gym" },
    description: `Memberships, payments in dollars and lira, tap-to-check-in, trainer programs and a member app. ${formatPrice(priceUsd)} a month. ${trialDays} days free.`,
  };
}

// Calm and luxurious: generous space, large serif type, one product image per
// section, slow fades only.

function Frame({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="rounded-[28px] bg-white p-2 shadow-[0_50px_100px_-40px_rgb(13_17_23/0.35)] ring-1 ring-ink/[0.06] sm:p-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[20px]">
        <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover object-left-top" />
      </div>
    </div>
  );
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-[260px] rounded-[46px] bg-ink p-3 shadow-[0_50px_100px_-40px_rgb(13_17_23/0.55)] sm:w-[300px]">
      <div className="relative aspect-[9/19] overflow-hidden rounded-[36px] bg-white">
        <Image src={src} alt={alt} fill sizes="300px" className="object-cover object-top" />
      </div>
    </div>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold tracking-[0.32em] text-ink/45 uppercase">{children}</p>
);

export default async function Home() {
  const { priceUsd, trialDays } = await getPricing();
  const price = formatPrice(priceUsd);

  const chapters = [
    {
      kicker: "Members",
      title: (
        <>
          Everyone, <em>in one place.</em>
        </>
      ),
      body: "Who is active, who ends this week, who owes. A list that is always right, without the notebook.",
      media: <Frame src="/landing/members.png" alt="Gymix members list" />,
    },
    {
      kicker: "Payments",
      title: (
        <>
          Paid, in dollars <em>or lira.</em>
        </>
      ),
      body: "Cash, Whish, OMT, card or transfer, at your own rate. Unpaid members are paused automatically, and told why. No awkward conversations.",
      media: <Frame src="/landing/billing.png" alt="Gymix billing" />,
    },
    {
      kicker: "Members' app",
      title: (
        <>
          A gym <em>in their pocket.</em>
        </>
      ),
      body: "Today's workout from their trainer, classes to book, progress to be proud of. They tap their phone at the door to check in. No app store.",
      media: <PhoneFrame src="/landing/member-home.png" alt="The Gymix member app" />,
    },
  ];

  const cta = (
    <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-medium text-white transition hover:bg-ink/85">
        Start {trialDays} days free <ArrowRight className="size-4" />
      </Link>
      <Link href="/demo" className="px-4 py-4 text-base font-medium text-ink/65 transition hover:text-ink">
        Explore the live demo
      </Link>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col bg-[#f6f5f1] text-ink">
      <MarketingNav />

      {/* Hero */}
      <section className="px-5 pt-24 pb-16 sm:pt-36">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <Kicker>Gymix · Built for gyms in Lebanon</Kicker>
          </Reveal>
          <Reveal delay={150}>
            <h1 className="mt-8 font-serif text-[3.1rem] leading-[1.02] tracking-[-0.02em] sm:text-[5.5rem]">
              Your gym,<br /> <em className="text-ink/50">running itself.</em>
            </h1>
          </Reveal>
          <Reveal delay={300}>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-ink/60">
              Memberships, payments and check-in, beautifully handled. So you spend your time on the floor, not at the desk.
            </p>
          </Reveal>
          <Reveal delay={450}>{cta}</Reveal>
        </div>
        <Reveal delay={600} className="mx-auto mt-20 max-w-6xl sm:mt-28">
          <Frame src="/landing/overview-full.png" alt="The Gymix dashboard" priority />
        </Reveal>
      </section>

      {/* A quiet statement */}
      <section className="px-5 py-28 sm:py-40">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-serif text-3xl leading-[1.3] text-ink/80 sm:text-5xl sm:leading-[1.2]">
            Less chasing. Less counting. <em className="text-ink/45">More training.</em>
          </p>
        </Reveal>
      </section>

      {/* Chapters */}
      <section id="features" className="scroll-mt-20 px-5 pb-12">
        <div className="mx-auto max-w-6xl space-y-32 sm:space-y-44">
          {chapters.map((c, i) => (
            <div key={c.kicker} className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <Reveal className={`lg:col-span-5 ${i % 2 ? "lg:order-2" : ""}`}>
                <Kicker>{c.kicker}</Kicker>
                <h2 className="mt-5 font-serif text-4xl leading-[1.08] tracking-[-0.01em] sm:text-5xl [&_em]:text-ink/50">{c.title}</h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/60">{c.body}</p>
              </Reveal>
              <Reveal delay={200} className={`lg:col-span-7 ${i % 2 ? "lg:order-1" : ""}`}>
                {c.media}
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* Facts */}
      <section id="how" className="scroll-mt-20 px-5 py-32 sm:py-44">
        <div className="mx-auto grid max-w-5xl gap-y-14 border-t border-ink/10 pt-16 sm:grid-cols-3 sm:gap-x-10">
          {[
            [price, "a month, for the whole gym."],
            ["10 minutes", "to set up. We'll help."],
            ["A $1 sticker", "is all the hardware you need."],
          ].map(([n, l], i) => (
            <Reveal key={l} delay={i * 150}>
              <p className="font-serif text-4xl tracking-[-0.01em] sm:text-5xl">{n}</p>
              <p className="mt-3 text-ink/55">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-white px-5 py-28 sm:py-36">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <Kicker>Pricing</Kicker>
          <h2 className="mt-5 font-serif text-4xl sm:text-6xl">
            One price. <em className="text-ink/50">Everything.</em>
          </h2>
          <p className="mt-6 text-lg text-ink/60">
            {price} a month · unlimited members and staff · {trialDays} days free, no card.
          </p>
        </Reveal>
        <Reveal delay={150}>
          <PricingCard />
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="px-5 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-12 text-center">
            <h2 className="font-serif text-4xl sm:text-5xl">Questions, answered.</h2>
          </Reveal>
          <FaqList />
        </div>
      </section>

      {/* Close */}
      <section className="px-5 pt-16 pb-36 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl font-serif text-5xl leading-[1.05] tracking-[-0.02em] sm:text-7xl">
            Ready when <em className="text-ink/50">you are.</em>
          </h2>
          {cta}
        </Reveal>
      </section>
      <MarketingFooter />
    </div>
  );
}
