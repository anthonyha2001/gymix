"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Expand, Loader2, LogOut, RefreshCcw, Search, ShieldAlert, Shrink, Volume2, VolumeX } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { formatDate, formatUSD } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { MEMBER_CODE_FORMATS, startCameraScan, type CameraScan } from "@/lib/scan";
import { checkIn, searchMembers, type CheckInResult, type MemberHit } from "../dashboard/members/actions";
import { deskSnapshot, type DeskSnapshot } from "./actions";

const RESULT_MS = 5000;
const HOLD_EXIT_MS = 1200;

// The front-desk tablet. Everything is big enough to hit without looking,
// and every check-in gets a clear, colour-coded answer that clears itself.
export function FrontDesk({ gymName, timeZone, initial }: { gymName: string; timeZone: string; initial: DeskSnapshot }) {
  const router = useRouter();
  const [snap, setSnap] = useState(initial);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [sound, setSound] = useState(true);
  const [full, setFull] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const busy = useRef(false);
  const audio = useRef<AudioContext | null>(null);

  const refreshSnap = useCallback(() => deskSnapshot().then(setSnap).catch(() => {}), []);

  // A soft two-note chime for yes, a low double buzz for no.
  const chime = useCallback(
    (ok: boolean) => {
      if (!sound) return;
      try {
        audio.current ??= new AudioContext();
        const ctx = audio.current;
        const notes = ok ? [880, 1318.5] : [196, 174.6];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = ok ? "sine" : "square";
          o.frequency.value = f;
          const t = ctx.currentTime + i * (ok ? 0.11 : 0.16);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(ok ? 0.18 : 0.06, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.45 : 0.18));
          o.connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.5);
        });
      } catch {}
    },
    [sound],
  );

  const run = useCallback(
    (target: { code?: string; memberId?: string }) => {
      if (busy.current) return;
      busy.current = true;
      startTransition(async () => {
        const r = await checkIn(target);
        busy.current = false;
        setResult(r);
        setResultKey((k) => k + 1);
        setQuery("");
        setHits([]);
        const ok = !r.error && r.allowed;
        if (ok) haptics.success();
        else haptics.error();
        chime(ok);
        refreshSnap();
      });
    },
    [chime, refreshSnap],
  );

  // The answer clears itself.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(t);
  }, [result, resultKey]);

  // Numbers stay fresh (taps on the door sticker happen without the desk).
  useEffect(() => {
    const t = setInterval(refreshSnap, 15_000);
    return () => clearInterval(t);
  }, [refreshSnap]);

  // Keep the screen awake while the desk is open.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const take = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
      } catch {}
    };
    take();
    const onVisible = () => document.visibilityState === "visible" && take();
    document.addEventListener("visibilitychange", onVisible);
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, []);

  // USB / Bluetooth barcode readers type the code fast, then Enter.
  useEffect(() => {
    let buffer = "";
    let lastAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const now = performance.now();
      if (now - lastAt > 80) buffer = "";
      lastAt = now;
      if (e.key === "Enter") {
        if (buffer.length >= 4) run({ code: buffer.trim() });
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function search(value: string) {
    setQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => setHits(value.trim().length >= 2 ? await searchMembers(value) : []), 180);
  }

  const tone = !result ? "idle" : result.error || !result.allowed ? "no" : "yes";

  return (
    <div className="desk relative flex min-h-dvh flex-col overflow-hidden bg-ink text-white">
      <span aria-hidden className={`desk-flash desk-flash-${tone}`} key={`flash-${resultKey}`} />

      <header className="relative z-10 flex items-center gap-3 px-5 py-4 sm:px-8">
        <span className="grid size-10 place-items-center rounded-xl bg-brand text-ink">
          <LogoMark className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold tracking-tight">{gymName}</span>
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-brand">Front desk</span>
        </span>
        <Clock timeZone={timeZone} />
        <IconButton label={sound ? "Mute" : "Sound on"} onClick={() => setSound((s) => !s)}>
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </IconButton>
        <IconButton
          label={full ? "Leave full screen" : "Full screen"}
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
        >
          {full ? <Shrink className="size-5" /> : <Expand className="size-5" />}
        </IconButton>
        <HoldToExit onExit={() => router.push("/dashboard/check-in")} />
      </header>

      <main className="relative z-10 grid flex-1 gap-5 px-5 pb-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        <CameraPanel onCode={(text) => run({ code: text.trim() })} paused={pending} />

        <div className="flex min-h-0 flex-col gap-5">
          <div className="relative flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-[2rem] bg-white/[0.04] ring-1 ring-white/10">
            {result ? <Answer key={resultKey} result={result} /> : pending ? <Checking /> : <Ready />}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (/^[0-9A-F]{10}$/i.test(query.trim())) run({ code: query.trim() });
                else if (hits.length === 1) run({ memberId: hits[0].id });
              }}
              placeholder="Search a name or phone"
              aria-label="Search a member"
              className="h-16 w-full rounded-2xl bg-white/[0.06] pr-5 pl-14 text-lg text-white ring-1 ring-white/10 transition outline-none placeholder:text-white/35 focus:bg-white/[0.09] focus:ring-2 focus:ring-brand"
            />
            {hits.length > 0 && (
              <ul className="desk-hits absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-20 max-h-80 overflow-auto rounded-2xl bg-[#161c25] p-1.5 shadow-2xl ring-1 ring-white/10">
                {hits.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => run({ memberId: m.id })}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.06] active:scale-[0.99]"
                    >
                      <Initials name={m.fullName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.fullName}</span>
                        <span className="block truncate text-sm text-white/50">{[m.phone, m.planName].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-ink">Check in</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center gap-6 overflow-hidden border-t border-white/10 px-5 py-4 sm:px-8">
        <Stat label="Inside now" value={snap.inside} live />
        <Stat label="Today" value={snap.today} />
        <ol className="desk-ticker flex min-w-0 flex-1 gap-2 overflow-hidden">
          {snap.recent.map((r) => (
            <li key={r.id} className={`flex shrink-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm ring-1 ${r.allowed ? "bg-white/[0.05] ring-white/10" : "bg-danger/15 ring-danger/30"}`}>
              <Initials name={r.name} size="xs" />
              <span className="max-w-[9rem] truncate">{r.name.split(" ")[0]}</span>
              <span className="text-xs tabular-nums text-white/40">{r.time}</span>
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}

function CameraPanel({ onCode, paused }: { onCode: (text: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const scan = useRef<CameraScan | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const latest = useRef(onCode);
  useEffect(() => {
    latest.current = onCode;
  });

  useEffect(() => {
    if (!on || !video.current) return;
    let alive = true;
    // Tablets on a stand face the member: the front camera by default.
    startCameraScan(video.current, {
      facing,
      formats: MEMBER_CODE_FORMATS,
      quietMs: 4000,
      onCode: (t) => latest.current(t),
      onError: (m) => {
        setError(m);
        setOn(false);
      },
    }).then((s) => {
      if (alive) scan.current = s;
      else s.stop();
    });
    return () => {
      alive = false;
      scan.current?.stop();
      scan.current = null;
    };
  }, [on, facing]);

  return (
    <section className="relative flex min-h-[22rem] flex-col overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/10">
      {on ? (
        <>
          <video ref={video} playsInline muted className={`absolute inset-0 size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} aria-label="Camera" />
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className={`desk-target relative aspect-square w-[min(62%,22rem)] ${paused ? "is-reading" : ""}`}>
              <i />
              <i />
              <i />
              <i />
              <span className="scan-line absolute inset-x-4 h-0.5 rounded-full bg-brand shadow-[0_0_16px_#c8f135]" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-5">
            <span className="flex items-center gap-2 text-sm text-white/80">
              <span className="challenge-live size-2 rounded-full bg-brand" /> Show the member code to the camera
            </span>
            <span className="flex gap-2">
              <IconButton label="Switch camera" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
                <RefreshCcw className="size-5" />
              </IconButton>
              <IconButton label="Camera off" onClick={() => setOn(false)}>
                <CameraOff className="size-5" />
              </IconButton>
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="grid size-20 place-items-center rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
            <Camera className="size-9 text-brand" />
          </span>
          <p className="text-xl font-bold">Scan member codes</p>
          <p className="max-w-xs text-sm text-white/55">Members show the code in their Gymix app (Profile). Barcode readers plugged into the tablet work too.</p>
          {error && <p className="max-w-xs text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOn(true);
            }}
            className="mt-2 inline-flex h-14 items-center gap-2 rounded-2xl bg-brand px-7 text-lg font-semibold text-ink shadow-[0_14px_40px_-12px_rgb(200_241_53/0.7)] transition active:scale-[0.97]"
          >
            <Camera className="size-5" /> Start camera
          </button>
        </div>
      )}
    </section>
  );
}

function Ready() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <span aria-hidden className="desk-ready relative grid size-28 place-items-center">
        <i />
        <i />
        <span className="relative grid size-20 place-items-center rounded-3xl bg-brand text-ink">
          <LogoMark className="size-12" />
        </span>
      </span>
      <p className="mt-6 text-2xl font-bold tracking-tight">Ready</p>
      <p className="mt-1 text-white/50">Scan a code, or search a name below.</p>
    </div>
  );
}

function Checking() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/70">
      <Loader2 className="size-10 animate-spin text-brand" />
      Checking…
    </div>
  );
}

export function Answer({ result }: { result: CheckInResult }) {
  const ok = !result.error && result.allowed;
  const owes = result.balanceUsd > 0;
  const details = ok
    ? [
        result.planName && { k: "Plan", v: result.planName },
        result.endsOn && { k: "Until", v: formatDate(result.endsOn) },
        result.visitsLeft !== null && { k: "Visits left", v: String(result.visitsLeft) },
      ].filter(Boolean)
    : [];
  return (
    <div className={`desk-answer flex flex-1 flex-col p-7 ${ok ? "is-yes" : "is-no"}`}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className={`desk-answer-ring relative grid size-32 place-items-center rounded-full ${ok ? "bg-brand/15" : "bg-danger/15"}`}>
          {result.fullName ? <Initials name={result.fullName} size="lg" tone={ok ? "yes" : "no"} /> : <ShieldAlert className="size-12 text-danger" />}
        </span>
        <p className={`desk-answer-title mt-5 text-sm font-bold uppercase tracking-[0.22em] ${ok ? "text-brand" : "text-danger"}`}>
          {result.error ? "Code not found" : ok ? (result.alreadyIn ? "Already in · welcome back" : "Welcome") : "Not allowed in"}
        </p>
        <p className="desk-answer-name mt-2 text-4xl font-black tracking-tight text-balance">{result.fullName ?? "Unknown code"}</p>
        {!ok && <p className="mt-2 max-w-sm text-lg text-white/70">{result.error ? "Check the code, or search the member by name." : result.reason}</p>}
        {details.length > 0 && (
          <dl className="desk-answer-details mt-6 flex flex-wrap justify-center gap-2">
            {details.map((d) => d && (
              <div key={d.k} className="rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/10">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{d.k}</dt>
                <dd className="font-semibold">{d.v}</dd>
              </div>
            ))}
          </dl>
        )}
        {owes && <p className="desk-owes mt-4 rounded-full bg-danger px-4 py-1.5 font-semibold text-white">Owes {formatUSD(result.balanceUsd)}</p>}
      </div>
      <span aria-hidden className="desk-timer mt-4 h-1 rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${ok ? "bg-brand" : "bg-danger"}`} style={{ animationDuration: `${RESULT_MS}ms` }} />
      </span>
    </div>
  );
}

function Initials({ name, size, tone }: { name: string; size: "xs" | "sm" | "lg"; tone?: "yes" | "no" }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const cls = { xs: "size-6 text-[10px]", sm: "size-10 text-sm", lg: "size-24 text-3xl" }[size];
  const color = tone === "no" ? "bg-danger text-white" : tone === "yes" ? "bg-brand text-ink" : "bg-white/10 text-white";
  return <span className={`grid shrink-0 place-items-center rounded-full font-black ${cls} ${color}`}>{initials}</span>;
}

function Stat({ label, value, live = false }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="shrink-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {live && <span className="challenge-live size-1.5 rounded-full bg-brand" />}
        {label}
      </p>
      <p key={value} className="desk-stat text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function Clock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="hidden text-right leading-tight sm:block">
      <span className="block text-2xl font-black tabular-nums">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })}</span>
      <span className="block text-xs text-white/45">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone })}</span>
    </span>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-11 place-items-center rounded-xl bg-white/[0.06] text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white active:scale-95">
      {children}
    </button>
  );
}

// Leaving the desk takes a deliberate press and hold, so a member leaning on
// the counter can't close it.
function HoldToExit({ onExit }: { onExit: () => void }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = () => {
    const t0 = performance.now();
    const loop = () => {
      const v = Math.min(1, (performance.now() - t0) / HOLD_EXIT_MS);
      setP(v);
      if (v >= 1) return onExit();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setP(0);
  };
  return (
    <button
      type="button"
      aria-label="Hold to leave the front desk"
      title="Hold to leave"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="relative grid size-11 touch-none place-items-center overflow-hidden rounded-xl bg-white/[0.06] text-white/80 ring-1 ring-white/10"
    >
      <span aria-hidden className="absolute inset-x-0 bottom-0 bg-white/20" style={{ height: `${p * 100}%` }} />
      <LogOut className="relative size-5" />
    </button>
  );
}
