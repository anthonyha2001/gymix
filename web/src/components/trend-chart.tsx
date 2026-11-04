"use client";

import { useState } from "react";

// Single-series trend line (e.g. weight over time). One series, so no legend:
// the title names it. 2px line, ≥8px markers with a surface ring, 10% area
// wash, hairline grid, end value labelled, crosshair + tooltip on hover.
// Colour validated (light surface) with the dataviz palette checker.
const SERIES = "#2a78d6";
const SURFACE = "#ffffff";
const W = 420;
const H = 170;
const PAD = { top: 16, right: 48, bottom: 26, left: 40 };

export type TrendPoint = { date: string; value: number };

function niceTicks(min: number, max: number) {
  const span = max - min || Math.max(Math.abs(max), 1);
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => span / s <= 4) ?? 100;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return ticks.length >= 2 ? ticks : [lo, lo + step];
}

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function TrendChart({ title, unit, points }: { title: string; unit: string; points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1);
  const first = sorted[0];

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      {last && (
        <p className="text-sm">
          <span className="text-xl font-semibold">
            {last.value} {unit}
          </span>
          {first && first !== last && (
            <span className="ml-2 text-muted">
              {last.value - first.value >= 0 ? "+" : "−"}
              {Math.abs(Math.round((last.value - first.value) * 10) / 10)} {unit} since {shortDate(first.date)}
            </span>
          )}
        </p>
      )}
    </div>
  );

  if (sorted.length < 2) {
    return (
      <div className="space-y-2">
        {header}
        <p className="rounded-lg bg-canvas px-3 py-6 text-center text-sm text-muted">
          {sorted.length ? "Add another measurement to see your trend." : "No data yet."}
        </p>
      </div>
    );
  }

  // At least two points from here on.
  const end = sorted[sorted.length - 1];
  const t0 = Date.parse(first.date);
  const t1 = Date.parse(end.date);
  const ticks = niceTicks(Math.min(...sorted.map((p) => p.value)), Math.max(...sorted.map((p) => p.value)));
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const x = (d: string) => PAD.left + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const line = sorted.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(end.date)},${H - PAD.bottom} L${x(first.date)},${H - PAD.bottom} Z`;
  const active = hover !== null ? sorted[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    sorted.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(sorted[best].date) - px)) best = i;
    });
    setHover(best);
  }

  return (
    <figure className="space-y-2">
      {header}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`${title}: from ${first.value} ${unit} on ${shortDate(first.date)} to ${end.value} ${unit} on ${shortDate(end.date)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e4de" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={13} fill="#5d6470">
                {t}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} fontSize={13} fill="#5d6470">
            {shortDate(first.date)}
          </text>
          <text x={W - PAD.right} y={H - 6} fontSize={13} fill="#5d6470" textAnchor="end">
            {shortDate(end.date)}
          </text>
          <path d={area} fill={SERIES} opacity={0.1} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && (
            <line x1={x(active.date)} x2={x(active.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="#5d6470" strokeWidth={1} />
          )}
          {sorted.map((p, i) => (
            <circle
              key={p.date + i}
              cx={x(p.date)}
              cy={y(p.value)}
              r={hover === i ? 6 : 4}
              fill={SERIES}
              stroke={SURFACE}
              strokeWidth={2}
            />
          ))}
          {/* End value, labelled directly. */}
          <text x={x(end.date) + 10} y={y(end.value)} dominantBaseline="middle" fontSize={14} fontWeight={600} fill="#0d1117">
            {end.value}
          </text>
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: `${(x(active.date) / W) * 100}%`, top: `${(y(active.value) / H) * 100}%`, marginTop: -10 }}
          >
            <p className="font-semibold">
              {active.value} {unit}
            </p>
            <p className="text-muted">{shortDate(active.date)}</p>
          </div>
        )}
      </div>
    </figure>
  );
}
