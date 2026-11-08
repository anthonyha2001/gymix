"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Dumbbell, Megaphone, Trophy, Users, WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

// Plays a screen's slides in a loop. Fetches its content every minute and keeps
// showing the last content if the connection drops. Keeps the display awake,
// and reloads itself every six hours to pick up new versions of Gymix.

type Slide = {
  id: string;
  kind: "announcement" | "promo" | "schedule" | "leaderboard" | "achievements" | "occupancy";
  title: string | null;
  body: string | null;
  image_url: string | null;
  theme: "dark" | "lime" | "light";
  duration: number;
  data: unknown;
};
type Feed = { screen: { name: string; orientation: string }; gym: { name: string; timezone: string }; slides: Slide[] };
type ClassRow = { name: string; time: string; minutes: number; location: string | null; trainer: string | null; spots: number; booked: number };
type Leader = { name: string; visits: number };
type Record_ = { name: string; exercise: string; weight: number; reps: number };
type Occ = { people: number; capacity: number | null; level: "quiet" | "moderate" | "busy" | "full"; usual_now: number | null };

const LEVEL = { quiet: "Quiet", moderate: "Moderate", busy: "Busy", full: "Full" } as const;

export function ScreenPlayer({ token }: { token: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [index, setIndex] = useState(0);
  const [clock, setClock] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/screens/${token}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setProblem(body.error ?? "This screen isn't available.");
        return;
      }
      setFeed(body as Feed);
      setProblem(null);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 60_000);
    const reload = setTimeout(() => location.reload(), 6 * 3600_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearTimeout(reload);
    };
  }, [load]);

  // Stay awake (where the browser allows it), and re-ask after the tab returns.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
      } catch {
        lock = null;
      }
    };
    ask();
    const onVis = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const tz = feed?.gym.timezone;
  useEffect(() => {
    const tick = () => setClock(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [tz]);

  const slides = feed?.slides.filter(hasContent) ?? [];
  const current = slides.length ? slides[index % slides.length] : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!current) return;
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % Math.max(1, slides.length)), current.duration * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, slides.length]);

  if (problem) {
    return (
      <Shell gym={null} clock={clock} offline={false}>
        <div className="grid h-full place-items-center text-center">
          <div>
            <p className="text-[4vh] font-semibold">This screen isn&apos;t showing anything</p>
            <p className="mt-2 text-[2.4vh] text-white/60">{problem}</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (!feed) {
    return <div className="fixed inset-0 grid place-items-center bg-ink"><span className="grid size-24 place-items-center rounded-3xl bg-brand p-5 text-ink"><LogoMark className="size-full animate-pulse" /></span></div>;
  }

  return (
    <Shell gym={feed.gym.name} clock={clock} offline={offline}>
      {!current ? (
        <div className="grid h-full place-items-center text-center">
          <div>
            <p className="text-[6vh] font-bold">Welcome to {feed.gym.name}</p>
            <p className="mt-2 text-[2.6vh] text-white/60">Add slides in Gymix → Screens.</p>
          </div>
        </div>
      ) : (
        <div key={`${current.id}-${index}`} className="screen-in h-full">
          <SlideView slide={current} />
        </div>
      )}
      {slides.length > 1 && current && (
        <div className="absolute inset-x-[4vw] bottom-[3vh] flex gap-[0.6vw]">
          {slides.map((s, i) => (
            <span key={s.id} className="h-[0.5vh] flex-1 overflow-hidden rounded-full bg-white/15">
              {i === index % slides.length && <span key={index} className="screen-progress block h-full rounded-full bg-brand" style={{ animationDuration: `${s.duration}s` }} />}
              {i < index % slides.length && <span className="block h-full rounded-full bg-white/50" />}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}

function hasContent(s: Slide) {
  if (s.kind === "announcement" || s.kind === "promo") return Boolean(s.title);
  if (s.kind === "occupancy") return Boolean(s.data);
  return Array.isArray(s.data) && s.data.length > 0;
}

function Shell({ gym, clock, offline, children }: { gym: string | null; clock: string; offline: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex cursor-none flex-col overflow-hidden bg-ink text-white select-none">
      <style>{`
        @keyframes screen-in { from { opacity: 0; transform: translateY(2vh) scale(0.99); } to { opacity: 1; transform: none; } }
        .screen-in { animation: screen-in 700ms cubic-bezier(.22,1,.36,1) both; }
        @keyframes screen-progress { from { width: 0; } to { width: 100%; } }
        .screen-progress { animation: screen-progress linear both; }
        @media (prefers-reduced-motion: reduce) { .screen-in, .screen-progress { animation: none; } .screen-progress { width: 100%; } }
      `}</style>
      <header className="flex items-center justify-between px-[4vw] pt-[3vh]">
        <span className="flex items-center gap-[1vw]">
          <span className="grid size-[5vh] place-items-center rounded-[1.2vh] bg-brand p-[0.8vh] text-ink">
            <LogoMark className="size-full" />
          </span>
          {gym && <span className="text-[2.8vh] font-semibold">{gym}</span>}
        </span>
        <span className="flex items-center gap-[1vw] text-[2.4vh] text-white/70 tabular-nums">
          {offline && <WifiOff className="size-[2.4vh] text-amber-300" aria-label="Offline" />}
          {clock}
        </span>
      </header>
      <main className="relative min-h-0 flex-1 px-[4vw] pt-[3vh] pb-[7vh]">{children}</main>
    </div>
  );
}

function Title({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <h1 className="flex items-center gap-[1.2vw] text-[5vh] font-bold tracking-tight">
      <span className="grid size-[7vh] place-items-center rounded-[1.6vh] bg-brand text-ink">
        <Icon className="size-[3.6vh]" />
      </span>
      {children}
    </h1>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "announcement":
    case "promo": {
      const theme = { dark: "bg-[#161b22] text-white", lime: "bg-brand text-ink", light: "bg-white text-ink" }[slide.theme];
      return (
        <div className={`flex h-full overflow-hidden rounded-[3vh] ${theme}`}>
          <div className="flex flex-1 flex-col justify-center px-[5vw] py-[5vh]">
            <p className={`flex items-center gap-[0.8vw] text-[2.4vh] font-semibold tracking-widest uppercase ${slide.theme === "dark" ? "text-brand" : "opacity-70"}`}>
              <Megaphone className="size-[2.6vh]" /> {slide.kind === "promo" ? "Offer" : "News"}
            </p>
            <h1 className="mt-[2vh] text-[8vh] leading-[1.02] font-bold tracking-tight">{slide.title}</h1>
            {slide.body && <p className="mt-[3vh] max-w-[60ch] text-[3.4vh] leading-snug opacity-80">{slide.body}</p>}
          </div>
          {slide.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image_url} alt="" className="h-full w-[42%] object-cover" />
          )}
        </div>
      );
    }
    case "schedule": {
      const rows = (slide.data as ClassRow[]).slice(0, 6);
      return (
        <div className="flex h-full flex-col">
          <Title icon={CalendarDays}>{slide.title || "Classes today"}</Title>
          <ul className="mt-[4vh] grid flex-1 content-start gap-[1.6vh]">
            {rows.map((c) => {
              const full = c.booked >= c.spots;
              return (
                <li key={c.name + c.time} className="flex items-center gap-[2vw] rounded-[2vh] bg-white/[0.06] px-[2.4vw] py-[2.2vh]">
                  <span className="w-[10vw] text-[4.4vh] font-bold tabular-nums">{c.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[3.6vh] font-semibold">{c.name}</span>
                    <span className="block text-[2.4vh] text-white/60">{[c.trainer, c.location, `${c.minutes} min`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`rounded-full px-[1.4vw] py-[0.8vh] text-[2.4vh] font-semibold ${full ? "bg-white/10 text-white/70" : "bg-brand text-ink"}`}>
                    {full ? "Full" : `${c.spots - c.booked} spots left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    case "leaderboard": {
      const rows = (slide.data as Leader[]).slice(0, 6);
      const top = rows[0]?.visits || 1;
      return (
        <div className="flex h-full flex-col">
          <Title icon={Trophy}>{slide.title || "Most visits this month"}</Title>
          <ol className="mt-[4vh] grid flex-1 content-start gap-[1.4vh]">
            {rows.map((r, i) => (
              <li key={r.name + i} className="flex items-center gap-[2vw] rounded-[2vh] bg-white/[0.06] px-[2.4vw] py-[1.8vh]">
                <span className={`grid size-[6vh] shrink-0 place-items-center rounded-full text-[3vh] font-bold ${i === 0 ? "bg-brand text-ink" : "bg-white/10"}`}>{i + 1}</span>
                <span className="w-[22vw] truncate text-[3.6vh] font-semibold">{r.name}</span>
                <span className="h-[1.6vh] flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.visits / top) * 100}%` }} />
                </span>
                <span className="w-[10vw] text-right text-[3.2vh] font-bold tabular-nums">{r.visits} visits</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "achievements": {
      const rows = (slide.data as Record_[]).slice(0, 6);
      return (
        <div className="flex h-full flex-col">
          <Title icon={Dumbbell}>{slide.title || "New personal records"}</Title>
          <ul className="mt-[4vh] grid flex-1 grid-cols-2 content-start gap-[2vh]">
            {rows.map((r, i) => (
              <li key={r.name + r.exercise + i} className="rounded-[2.4vh] bg-white/[0.06] p-[3vh]">
                <p className="text-[2.6vh] text-white/60">{r.name}</p>
                <p className="mt-[0.6vh] truncate text-[3.4vh] font-semibold">{r.exercise}</p>
                <p className="mt-[1vh] text-[5vh] font-bold text-brand tabular-nums">
                  {Number(r.weight)} kg <span className="text-[3vh] font-semibold text-white/70">× {r.reps}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "occupancy": {
      const o = slide.data as Occ;
      const pct = o.capacity ? Math.min(100, Math.round((o.people / o.capacity) * 100)) : null;
      return (
        <div className="flex h-full flex-col">
          <Title icon={Users}>{slide.title || "Right now"}</Title>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[4vh] font-semibold text-brand">{LEVEL[o.level]}</p>
            <p className="mt-[1vh] text-[20vh] leading-none font-bold tracking-tight tabular-nums">
              {o.people}
              <span className="ml-[1.5vw] text-[5vh] font-semibold text-white/60">{o.capacity ? `of ${o.capacity}` : "people"}</span>
            </p>
            {pct !== null && (
              <span className="mt-[4vh] block h-[2.4vh] max-w-[70vw] overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
            )}
            {slide.body && <p className="mt-[3vh] text-[3vh] text-white/70">{slide.body}</p>}
          </div>
        </div>
      );
    }
  }
}
