"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

// The control room's visual kit. One rule for colour: quantities are lime,
// comparisons are lime against neutral grey, and green / amber / red only ever
// mean a status (with a word and an icon next to them). Every chart answers
// on hover, and everything eases in once.

export const fmt = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : Math.round(n).toLocaleString("en-US"));
export const duration = (s: number) => (s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`);
export const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
};

// ----------------------------------------------------------------- panels
export function Panel({ title, action, children, className = "", pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`room-panel relative overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.07] ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          {title && <h2 className="text-[13px] font-semibold tracking-wide text-white/80">{title}</h2>}
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

// Counts up once from zero.
export function Num({ value, format = fmt, className = "" }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>;
}

// A headline number. `delta` is the change vs the previous period (status
// colours, with an arrow so it never relies on colour alone).
export function Stat({ label, value, format, hint, delta, upIsGood = true, live = false }: { label: string; value: number; format?: (n: number) => string; hint?: ReactNode; delta?: number | null; upIsGood?: boolean; live?: boolean }) {
  const good = delta == null || delta === 0 ? null : delta > 0 === upIsGood;
  return (
    <div className="room-stat rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">
        {live && <span className="room-live size-1.5 rounded-full bg-brand" />}
        {label}
      </p>
      <p className="mt-2 text-[2rem] leading-none font-black tracking-tight text-white">
        <Num value={value} format={format} />
      </p>
      <div className="mt-2 flex min-h-5 items-center gap-2 text-xs text-white/45">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${good === null ? "bg-white/5 text-white/60" : good ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
            {delta > 0 ? <ArrowUpRight className="size-3" /> : delta < 0 ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
            {Math.abs(Math.round(delta))}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bar list
// Ranked rows: the label, its number, and a lime bar to scale. The bar grows
// in on first paint; hovering a row shows its share.
export function BarList({ rows, format = fmt, empty = "Nothing yet", limit = 8, labelClass = "" }: { rows: { label: ReactNode; value: number; key?: string; sub?: ReactNode }[]; format?: (n: number) => string; empty?: string; limit?: number; labelClass?: string }) {
  const [all, setAll] = useState(false);
  const total = rows.reduce((n, r) => n + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const shown = all ? rows : rows.slice(0, limit);
  if (!rows.length) return <p className="py-6 text-center text-sm text-white/35">{empty}</p>;
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((r, i) => (
          <li key={r.key ?? i} className="group relative" title={`${format(r.value)} · ${total ? Math.round((r.value / total) * 100) : 0}%`}>
            <div className="absolute inset-0 rounded-lg transition-colors group-hover:bg-white/[0.03]" />
            <div
              className="room-bar-fill absolute inset-y-0 left-0 rounded-lg bg-brand/[0.16] transition-colors group-hover:bg-brand/[0.28]"
              style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, animationDelay: `${i * 40}ms` }}
            />
            <div className="relative flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className={`min-w-0 truncate text-white/85 ${labelClass}`}>
                {r.label}
                {r.sub && <span className="ml-2 text-xs text-white/40">{r.sub}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-white">
                {format(r.value)}
                <span className="ml-2 inline-block w-9 text-right text-xs font-normal text-white/35 opacity-0 transition group-hover:opacity-100">{total ? Math.round((r.value / total) * 100) : 0}%</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-xs font-medium text-white/50 transition hover:text-white">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------- area chart
// One series over time: a lime line with a soft fill, a crosshair and a
// tooltip that follows the pointer. The line draws itself in on first paint.
export function AreaChart({ points, height = 200, format = fmt, label = "value", compare }: { points: { x: string; y: number }[]; height?: number; format?: (n: number) => string; label?: string; compare?: { x: string; y: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { t: 12, r: 8, b: 24, l: 36 };
  const max = Math.max(1, ...points.map((p) => p.y), ...(compare ?? []).map((p) => p.y));
  const nice = niceMax(max);
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const line = (ps: { y: number }[]) => ps.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const d = line(points);
  const area = points.length ? `${d} L${x(points.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z` : "";
  const ticks = [0, nice / 2, nice];
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));

  if (!points.length) return <p className="grid place-items-center text-sm text-white/35" style={{ height }}>No data in this period</p>;
  return (
    <div ref={box} className="relative" style={{ height }}>
      <svg width={w} height={height} className="overflow-visible" role="img" aria-label={`${label} over time`}>
        <defs>
          <linearGradient id="room-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8f135" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#c8f135" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-white/35 text-[10px] tabular-nums">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % every === 0 ? (
            <text key={p.x} x={x(i)} y={height - 6} textAnchor="middle" className="fill-white/35 text-[10px]">
              {shortDay(p.x)}
            </text>
          ) : null,
        )}
        <path d={area} fill="url(#room-area)" className="room-area" />
        {compare && compare.length > 1 && <path d={line(compare)} fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth="1.5" strokeDasharray="4 4" />}
        <path d={d} fill="none" stroke="#c8f135" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="room-line" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="rgb(255 255 255 / 0.25)" />
            <circle cx={x(hover)} cy={y(points[hover].y)} r="5" fill="#c8f135" stroke="#0b0f15" strokeWidth="2" />
          </g>
        )}
        <rect
          x={pad.l}
          y={pad.t}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-[#1a212c] px-3 py-2 text-xs shadow-xl ring-1 ring-white/10" style={{ left: Math.min(w - 70, Math.max(70, x(hover))) }}>
          <p className="text-white/50">{longDay(points[hover].x)}</p>
          <p className="font-semibold text-white">
            {format(points[hover].y)} {label}
          </p>
          {compare?.[hover] && <p className="text-white/45">previous: {format(compare[hover].y)}</p>}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const shortDay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : iso);
const longDay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : iso);

// --------------------------------------------------------------- columns
// Small vertical bars (e.g. visitors per minute in the last hour).
export function Columns({ values, labels, height = 64, format = fmt, unit = "" }: { values: number[]; labels: string[]; height?: number; format?: (n: number) => string; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }} onPointerLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)}>
            <div
              className={`room-col w-full rounded-t-[3px] transition-colors ${hover === i ? "bg-brand" : v ? "bg-brand/60" : "bg-white/[0.06]"}`}
              style={{ height: `${Math.max(v ? 6 : 3, (v / max) * 100)}%`, animationDelay: `${i * 12}ms` }}
            />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-lg bg-[#1a212c] px-2.5 py-1 text-xs whitespace-nowrap text-white shadow-lg ring-1 ring-white/10" style={{ left: `${((hover + 0.5) / values.length) * 100}%` }}>
          <b>{format(values[hover])}</b> {unit} · {labels[hover]}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- heatmap
// Day of week × hour, one lime scale (dim = few, bright = many).
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function Heatmap({ cells, unit = "visits" }: { cells: { dow: number; hour: number; n: number }[]; unit?: string }) {
  const [hover, setHover] = useState<{ d: number; h: number; n: number } | null>(null);
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const c of cells) g[c.dow][c.hour] = Number(c.n);
    return g;
  }, [cells]);
  const max = Math.max(1, ...grid.flat());
  const step = (n: number) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const shades = ["rgb(255 255 255 / 0.04)", "rgb(200 241 53 / 0.16)", "rgb(200 241 53 / 0.32)", "rgb(200 241 53 / 0.52)", "rgb(200 241 53 / 0.75)", "rgb(200 241 53 / 1)"];
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="flex items-center gap-[3px] py-[1.5px]">
              <span className="w-9 shrink-0 text-[10px] text-white/40">{DAYS[d]}</span>
              {grid[d].map((n, h) => (
                <span
                  key={h}
                  onPointerEnter={() => setHover({ d, h, n })}
                  onPointerLeave={() => setHover(null)}
                  className={`room-cell aspect-square flex-1 rounded-[4px] transition-transform hover:scale-125 ${hover?.d === d && hover.h === h ? "ring-2 ring-white" : ""}`}
                  style={{ background: shades[step(n)], animationDelay: `${(d * 24 + h) * 3}ms` }}
                />
              ))}
            </div>
          ))}
          <div className="mt-1 flex gap-[3px] pl-9">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="flex-1 text-center text-[9px] text-white/30">
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/45">
        <span>{hover ? `${DAYS[hover.d]} ${hover.h}:00 to ${hover.h + 1}:00 · ${hover.n} ${unit}` : "Beirut time · hover a square"}</span>
        <span className="flex items-center gap-1">
          Fewer
          {shades.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- funnel
// Steps from first visit to sign-up: each bar to scale, with the share that
// made it from the step before.
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : s.value;
        const rate = prev ? Math.round((s.value / prev) * 100) : 0;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-white/80">{s.label}</span>
              <span className="tabular-nums">
                <b className="text-white">{fmt(s.value)}</b>
                {i > 0 && <span className="ml-2 text-xs text-white/45">{rate}% of the step before</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="room-bar-fill h-full rounded-full bg-gradient-to-r from-brand/70 to-brand" style={{ width: `${Math.max(1.5, (s.value / top) * 100)}%`, animationDelay: `${i * 120}ms` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------- split bar
// Two parts of a whole: lime and neutral grey, both labelled.
export function Split({ a, b }: { a: { label: string; value: number }; b: { label: string; value: number } }) {
  const total = Math.max(1, a.value + b.value);
  const pa = Math.round((a.value / total) * 100);
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        <div className="room-bar-fill rounded-l-full bg-brand" style={{ width: `${pa}%` }} />
        <div className="flex-1 rounded-r-full bg-white/20" />
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="flex items-center gap-2 text-white/80">
          <span className="size-2.5 rounded-full bg-brand" /> {a.label} <b className="text-white tabular-nums">{pa}%</b>
        </span>
        <span className="flex items-center gap-2 text-white/80">
          <span className="size-2.5 rounded-full bg-white/30" /> {b.label} <b className="text-white tabular-nums">{100 - pa}%</b>
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ score ring
// A gym's health: the ring and the word always together.
export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const tone = score >= 70 ? { c: "#34d399", t: "Healthy" } : score >= 40 ? { c: "#fbbf24", t: "Watch" } : { c: "#fb7185", t: "At risk" };
  const r = size / 2 - 4;
  const C = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-2" title={`${tone.t} · ${score}/100`}>
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="4" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone.c} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} className="room-ring" />
        </svg>
        <span className="absolute text-xs font-bold tabular-nums text-white">{score}</span>
      </span>
      <span className="text-xs font-medium" style={{ color: tone.c }}>
        {tone.t}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------- chips
export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${o.value === value ? "bg-white text-ink shadow" : "text-white/55 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
