"use client";

import { useState } from "react";

// One metric per day as bars: a single series (no legend; the selected metric
// names it), the validated blue used by the app's other charts, 4px rounded
// tops on the baseline, a 2px gap, hairline grid, the latest day labelled, and a
// tooltip on hover/tap. A visually hidden list mirrors it for screen readers.
const SERIES = "#2a78d6";
const W = 720;
const H = 220;
const PAD = { top: 20, right: 8, bottom: 26, left: 36 };

export type DailyPoint = {
  day: string;
  views: number;
  visitors: number;
  logins: number;
  failed_logins: number;
  signups: number;
  errors: number;
  requests: number;
};

export type DailyMetric = Exclude<keyof DailyPoint, "day">;

const METRICS: { id: DailyMetric; label: string; unit: [string, string] }[] = [
  { id: "views", label: "Page views", unit: ["page view", "page views"] },
  { id: "visitors", label: "Visitors", unit: ["visitor", "visitors"] },
  { id: "requests", label: "Requests", unit: ["request", "requests"] },
  { id: "logins", label: "Logins", unit: ["login", "logins"] },
  { id: "failed_logins", label: "Failed logins", unit: ["failed login", "failed logins"] },
  { id: "signups", label: "Sign-ups", unit: ["sign-up", "sign-ups"] },
  { id: "errors", label: "Errors", unit: ["error", "errors"] },
];

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const num = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function niceTop(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

export function DailyChart({ points, initial = "views" }: { points: DailyPoint[]; initial?: DailyMetric }) {
  const [metric, setMetric] = useState<DailyMetric>(initial);
  const [hover, setHover] = useState<number | null>(null);
  const meta = METRICS.find((m) => m.id === metric)!;
  const values = points.map((p) => p[metric]);
  const top = niceTop(Math.max(0, ...values));
  const ticks = [0, top / 2, top];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(1, Math.min(24, slot - 2));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover ?? points.length - 1;
  // Label every nth day so labels never collide.
  const every = Math.ceil(points.length / 8);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Metric" className="flex flex-wrap gap-1 rounded-xl bg-canvas p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === metric}
              onClick={() => setMetric(m.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                m.id === metric ? "bg-surface text-ink shadow-sm ring-1 ring-ink/5" : "text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm">
          <span className="text-xl font-semibold tabular-nums">{num(total)}</span>{" "}
          <span className="text-muted">
            {total === 1 ? meta.unit[0] : meta.unit[1]} in {points.length} days
          </span>
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${meta.label} per day, last ${points.length} days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e4de" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#5d6470">
              {compact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const v = p[metric];
          const cx = PAD.left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(v));
          const r = Math.min(4, h / 2, barW / 2);
          const x = cx - barW / 2;
          const yTop = y(v);
          const d =
            h > 0
              ? `M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`
              : "";
          const last = i === points.length - 1;
          return (
            <g key={p.day}>
              {d && <path d={d} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.45} />}
              {last && v > 0 && (
                <text x={Math.min(cx, W - PAD.right - 12)} y={yTop - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0d1117">
                  {compact(v)}
                </text>
              )}
              {(i % every === 0 || last) && (points.length - 1 - i >= every / 2 || last) && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#5d6470">
                  {dayFmt.format(new Date(`${p.day}T00:00:00Z`))}
                </text>
              )}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#c9ccc4" strokeWidth={1} />
      </svg>

      {points[shown] && (
        <div className="pointer-events-none flex justify-between rounded-lg bg-canvas px-3 py-2 text-xs">
          <span className="text-muted">{longFmt.format(new Date(`${points[shown].day}T00:00:00Z`))}</span>
          <span>
            <strong className="tabular-nums">{num(points[shown][metric])}</strong>{" "}
            {points[shown][metric] === 1 ? meta.unit[0] : meta.unit[1]}
          </span>
        </div>
      )}

      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.day}>
            {p.day}: {p[metric]} {meta.unit[1]}
          </li>
        ))}
      </ul>
    </div>
  );
}
