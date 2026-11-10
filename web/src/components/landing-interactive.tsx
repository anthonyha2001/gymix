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
      <div className="lx-float absolute right-1 -bottom-10 w-[28%] max-w-[230px] sm:right-6 sm:-bottom-16">
        <div className="relative aspect-[9/19] rounded-[22%/10.5%] bg-[#05070a] p-[4%] shadow-[0_40px_90px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10">
          <div className="relative h-full overflow-hidden rounded-[18%/8.5%]">
            <Image src="/landing/member-home.png" alt="The Gymix member app" fill sizes="230px" className="object-cover object-top" />
          </div>
        </div>
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
  return (
    <>
      <div className="space-y-24 px-4 py-20 lg:hidden">
        {CHAPTERS.map((c) => (
          <div key={c.kicker} className="mx-auto max-w-md">
            <Reveal>
              <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{c.kicker}</p>
              <h3 className="mt-3 text-3xl leading-[1.05] font-black tracking-tight text-white">{c.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-white/60">{c.body}</p>
            </Reveal>
            <Reveal delay={120} className="mt-8 flex justify-center">{c.screen}</Reveal>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <PinnedStory />
      </div>
    </>
  );
}

function PinnedStory() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref, setStep);
  return (
    <div ref={ref} data-step="0" className="lx-story relative" style={{ height: `${CHAPTERS.length * 90 + 40}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* chapters */}
          <div className="relative min-h-[340px]">
            {CHAPTERS.map((c, i) => (
              <div key={c.kicker} data-i={i} className="lx-chapter absolute inset-0 flex flex-col justify-center">
                <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">{c.kicker}</p>
                <h3 className="mt-4 text-4xl leading-[1.02] font-black tracking-tight text-white sm:text-5xl">{c.title}</h3>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">{c.body}</p>
              </div>
            ))}
            {/* progress */}
            <div className="absolute -bottom-20 left-0 flex gap-2">
              {CHAPTERS.map((c, i) => (
                <span key={c.kicker} data-i={i} className="lx-dot h-1 w-8 rounded-full bg-white/15" />
              ))}
            </div>
          </div>
          {/* screens */}
          <div className="relative h-[540px]">
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

// ---------------------------------------------------------------- words that light up as you scroll
const scrub = (p: number, el: HTMLElement) => el.style.setProperty("--p", p.toFixed(4));

export function ScrubText({ text, highlight = [] }: { text: string; highlight?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollVar(ref, scrub);
  const words = text.split(" ");
  return (
    <div ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-screen items-center">
        <p className="mx-auto max-w-5xl px-5 text-[2rem] leading-[1.12] font-black tracking-[-0.03em] sm:text-6xl" style={{ ["--n" as string]: words.length }}>
          {words.map((w, i) => (
            <span key={i} className={`lx-word ${highlight.some((h) => w.toLowerCase().startsWith(h)) ? "text-brand" : ""}`} style={{ ["--i" as string]: i }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hero particles: drifting "tap waves"
// Tiny lime copies of the logo's two waves drift up, turn slowly and fade;
// now and then one "taps" and sends out a thin ring, like a phone on the sticker.
export function TapWaves() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = Math.round(Math.min(26, Math.max(10, (w * h) / 42000)));
    type P = { x: number; y: number; s: number; vy: number; vx: number; rot: number; vr: number; a: number; life: number; ring: number };
    const spawn = (y?: number): P => ({
      x: Math.random() * w, y: y ?? h + 20, s: 6 + Math.random() * 12, vy: 8 + Math.random() * 16, vx: (Math.random() - 0.5) * 6,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.4, a: 0.25 + Math.random() * 0.45, life: 0, ring: -1,
    });
    const ps: P[] = Array.from({ length: count }, () => spawn(Math.random() * h));
    const draw = (p: P) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const fade = Math.min(1, p.life / 1.5) * Math.min(1, p.y / (h * 0.35));
      ctx.globalAlpha = p.a * fade;
      ctx.strokeStyle = "#c8f135";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.4, p.s * 0.16);
      ctx.beginPath(); ctx.arc(0, 0, p.s * 0.55, -Math.PI * 0.45, -Math.PI * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, p.s, -Math.PI * 0.45, -Math.PI * 0.05); ctx.stroke();
      ctx.restore();
      if (p.ring >= 0) {
        const r = p.ring;
        ctx.globalAlpha = (1 - r) * 0.35 * fade;
        ctx.strokeStyle = "#c8f135";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s + r * 60, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.life += dt; p.y -= p.vy * dt; p.x += p.vx * dt + Math.sin(p.life * 0.8 + i) * 0.15; p.rot += p.vr * dt;
        if (p.ring >= 0) { p.ring += dt / 1.6; if (p.ring >= 1) p.ring = -1; }
        else if (Math.random() < dt * 0.04) p.ring = 0;
        if (p.y < -30) ps[i] = spawn();
        draw(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
