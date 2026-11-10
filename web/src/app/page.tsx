import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FaqList, MarketingFooter, MarketingNav, PricingCard } from "@/components/marketing";
import { Reveal, TapWaves } from "@/components/landing-interactive";
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
    <div className="lx-paper flex flex-1 flex-col text-ink">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <TapWaves />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 sm:pt-24 lg:grid-cols-12 lg:gap-10 lg:pb-28">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/70">
                <span className="size-1.5 rounded-full bg-brand" /> Gym management software · Lebanon
              </p>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-6xl">
                Run your gym.
                <br />
                <span className="text-brand">Get paid on time.</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
                Gymix handles memberships, payments in dollars and lira, and check-in, and gives your members an app they actually use.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <ul className="mt-8 space-y-3 text-[15px] text-white/85">
                {[
                  "Unpaid members are stopped at the door automatically",
                  "Members check in by tapping their phone on a $1 sticker",
                  "Every payment, balance and renewal on one screen",
                ].map((x) => (
                  <li key={x} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                      <Check className="size-3.5" />
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-brand-strong">
                  Start {trialDays}-day free trial <ArrowRight className="size-4" />
                </Link>
                <Link href="/demo" className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">
                  Try the live demo
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/45">No card required · {price}/month for the whole gym</p>
            </Reveal>
          </div>
          <Reveal delay={250} className="relative lg:col-span-7">
            <div className="rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                <Image src="/landing/overview-full.png" alt="The Gymix dashboard" fill priority sizes="(min-width: 1024px) 700px, 100vw" className="object-cover object-left-top" />
              </div>
            </div>
            <div className="absolute -right-2 -bottom-10 w-[26%] max-w-[180px] sm:-right-6">
              <div className="rounded-[18%/8.5%] bg-[#05070a] p-[4%] shadow-2xl ring-1 ring-white/15">
                <div className="relative aspect-[9/19] overflow-hidden rounded-[14%/6.6%] bg-white">
                  <Image src="/landing/member-home.png" alt="The Gymix member app" fill sizes="200px" className="object-cover object-top" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="relative border-t border-white/10">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 lg:grid-cols-4">
            {[
              [price, "per month, whole gym"],
              ["USD + LBP", "at your own rate"],
              ["10 min", "to set up"],
              ["0", "apps to install"],
            ].map(([n, l]) => (
              <div key={l} className="py-7 sm:py-9">
                <dt className="text-2xl font-extrabold tracking-tight sm:text-3xl">{n}</dt>
                <dd className="mt-1 text-sm text-white/55">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* A quiet statement */}
      <section className="px-5 py-28 sm:py-40">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-extrabold tracking-tight text-3xl leading-[1.3] text-ink/80 sm:text-5xl sm:leading-[1.2]">
            Less chasing. Less counting. <em className="not-italic text-ink/45">More training.</em>
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
                <h2 className="mt-5 font-extrabold tracking-tight text-4xl leading-[1.08] tracking-[-0.01em] sm:text-5xl [&_em]:not-italic [&_em]:text-ink/45">{c.title}</h2>
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
              <p className="font-extrabold tracking-tight text-4xl tracking-[-0.01em] sm:text-5xl">{n}</p>
              <p className="mt-3 text-ink/55">{l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-canvas px-5 py-28 sm:py-36">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <Kicker>Pricing</Kicker>
          <h2 className="mt-5 font-extrabold tracking-tight text-4xl sm:text-6xl">
            One price. <em className="not-italic text-ink/45">Everything.</em>
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
            <h2 className="font-extrabold tracking-tight text-4xl sm:text-5xl">Questions, answered.</h2>
          </Reveal>
          <FaqList />
        </div>
      </section>

      {/* Close */}
      <section className="px-5 pt-16 pb-36 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl font-extrabold tracking-tight text-5xl leading-[1.05] tracking-[-0.02em] sm:text-7xl">
            Ready when <em className="not-italic text-ink/45">you are.</em>
          </h2>
          {cta}
        </Reveal>
      </section>
      <MarketingFooter />
    </div>
  );
}
