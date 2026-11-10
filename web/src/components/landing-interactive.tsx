"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

// The landing page's scroll storytelling: reveals, a laptop that tilts into
// place, and a pinned device whose screen follows the chapter you're reading.
// Everything is driven by CSS variables set on scroll (no re-renders).

function useScrollVar(ref: React.RefObject<HTMLElement | null>, onProgress: (p: number, el: HTMLElement) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      onProgress(p, el);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, onProgress]);
}

// ---------------------------------------------------------------- reveal on scroll
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("lx-in");
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lx-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- hero laptop: tilts up as you scroll
const tilt = (p: number, el: HTMLElement) => el.style.setProperty("--tilt", String(Math.min(1, p * 2.2)));

export function HeroLaptop() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref, tilt);
  return (
    <div ref={ref} className="lx-stage relative mx-auto w-full max-w-5xl px-4">
      <div className="lx-laptop">
        <div className="rounded-t-[22px] bg-[#1b2028] p-3 pb-0 shadow-[0_60px_140px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10 sm:p-4 sm:pb-0">
          <div className="relative aspect-[16/10] overflow-hidden rounded-t-lg">
            <Image src="/landing/overview-full.png" alt="The Gymix owner dashboard" fill priority sizes="(min-width: 1024px) 960px, 100vw" className="object-cover object-top" />
          </div>
        </div>
        <div className="mx-[-4%] h-4 rounded-b-[18px] bg-gradient-to-b from-[#2a313c] to-[#11151b] sm:h-5" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the pinned story
type Chapter = { kicker: string; title: string; body: string; screen: ReactNode };

function Laptop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full">
      <div className="rounded-t-[18px] bg-[#1b2028] p-2.5 pb-0 shadow-2xl ring-1 ring-white/10">
        <div className="relative aspect-[16/10] overflow-hidden rounded-t-md">
          <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 620px, 90vw" className="object-cover object-top" />
        </div>
      </div>
      <div className="mx-[-4%] h-3.5 rounded-b-2xl bg-gradient-to-b from-[#2a313c] to-[#11151b]" />
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto h-[520px] w-[262px] rounded-[44px] bg-[#05070a] p-3 shadow-2xl ring-1 ring-white/10">
      <div className="absolute top-4 left-1/2 z-10 h-6 w-20 -translate-x-1/2 rounded-full bg-[#05070a]" />
      <div className="relative h-full overflow-hidden rounded-[34px]">{children}</div>
    </div>
  );
}

const CHAPTERS: Chapter[] = [
  {
    kicker: "01 · Members",
    title: "Every member. Every membership.",
    body: "Who's active, who's ending this week, who owes. One list, always right, with or without the notebook.",
    screen: <Laptop src="/landing/members.png" alt="Members list" />,
  },
  {
    kicker: "02 · Payments",
    title: "Dollars or lira. Done.",
    body: "Cash, Whish, OMT, card or transfer. Set your rate once and every payment, invoice and balance follows.",
    screen: <Laptop src="/landing/billing.png" alt="Billing and payments" />,
  },
  {
    kicker: "03 · Check-in",
    title: "Members tap in with their phone.",
    body: "A $1 sticker at the door. No cards to print, no turnstile to install, no queue at the desk.",
    screen: (
      <Phone>
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-success px-6 text-center text-white">
          <CheckCircle2 className="size-16" />
          <p className="text-xs font-medium tracking-widest uppercase opacity-80">Checked in</p>
          <p className="text-3xl leading-tight font-bold">Welcome back, Karim</p>
          <p className="text-sm opacity-90">Monthly · until 29 Nov 2026</p>
          <span className="mt-3 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-ink">Start training</span>
        </div>
      </Phone>
    ),
  },
  {
    kicker: "04 · Getting paid",
    title: "Unpaid? Stopped at the door.",
    body: "A few days after an unpaid invoice the member is frozen automatically, and told why. Nobody at your desk has to say a word.",
    screen: (
      <Phone>
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-danger px-6 text-center text-white">
          <XCircle className="size-16" />
          <p className="text-3xl font-bold">Not allowed in</p>
          <p className="text-lg font-medium">Fadi Germanos</p>
          <p className="text-sm leading-snug opacity-90">Account frozen: unpaid balance of $25.00. Please see the front desk.</p>
        </div>
      </Phone>
    ),
  },
  {
    kicker: "05 · The member app",
    title: "An app your members actually open.",
    body: "Today's workout from their trainer, classes to book, personal records and progress. Installed from a link, no app store.",
    screen: (
      <Phone>
        <Image src="/landing/member-home.png" alt="The member app" fill sizes="262px" className="object-cover object-top" />
      </Phone>
    ),
  },
  {
    kicker: "06 · Your day",
    title: "Classes, programs, your whole team.",
    body: "Schedules and bookings, programs built from your real machines, and roles for managers, front desk and trainers. Trainers never see money.",
    screen: <Laptop src="/landing/schedule.png" alt="Class schedule" />,
  },
];

const setStep = (p: number, el: HTMLElement) => {
  const i = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
  if (el.dataset.step !== String(i)) el.dataset.step = String(i);
  el.style.setProperty("--story", String(p));
};

export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref, setStep);
  return (
    <div ref={ref} data-step="0" className="lx-story relative" style={{ height: `${CHAPTERS.length * 90 + 40}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* chapters */}
          <div className="relative min-h-[300px] lg:min-h-[340px]">
            {CHAPTERS.map((c, i) => (
              <div key={c.kicker} data-i={i} className="lx-chapter absolute inset-0 flex flex-col justify-center">
                <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{c.kicker}</p>
                <h3 className="mt-4 text-4xl leading-[1.02] font-black tracking-tight text-white sm:text-5xl">{c.title}</h3>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">{c.body}</p>
              </div>
            ))}
            {/* progress */}
            <div className="absolute -bottom-16 left-0 flex gap-2 lg:-bottom-20">
              {CHAPTERS.map((c, i) => (
                <span key={c.kicker} data-i={i} className="lx-dot h-1 w-8 rounded-full bg-white/15" />
              ))}
            </div>
          </div>
          {/* screens */}
          <div className="relative h-[440px] sm:h-[540px]">
            {CHAPTERS.map((c, i) => (
              <div key={c.kicker} data-i={i} className="lx-screen absolute inset-0 flex items-center justify-center">
                {c.screen}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
