"use client";

import { useState } from "react";

// Workouts per week as bars (magnitude over time, one series: no legend, the
// title names it). Same validated blue as the trend chart; 4px rounded tops
// anchored on the baseline, a 2px gap between bars, hairline grid, the latest
// week labelled, and a tooltip on hover/tap. A text list mirrors it for screen readers.
const SERIES = "#2a78d6";
const W = 420;
const H = 160;
const PAD = { top: 18, right: 8, bottom: 24, left: 26 };

export type WeekBar = { weekStart: string; label: string; workouts: number; volumeKg: number };

export function WeeklyChart({ weeks }: { weeks: WeekBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(3, ...weeks.map((w) => w.workouts));
  const ticks = max <= 4 ? [0, 2, 4] : [0, Math.ceil(max / 2), max];
  const top = Math.max(...ticks);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / weeks.length;
  const barW = Math.min(28, slot - 2);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const total = weeks.reduce((n, w) => n + w.workouts, 0);
  const shown = hover ?? weeks.length - 1;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-muted">Workouts per week</h3>
        <p className="text-sm">
          <span className="text-xl font-semibold">{total}</span> <span className="text-muted">in {weeks.length} weeks</span>
        </p>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Workouts per week, last ${weeks.length} weeks`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e4de" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#5d6470">
                {t}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = Math.max(0, y(0) - y(w.workouts));
            const r = Math.min(4, h / 2, barW / 2);
            const x = cx - barW / 2;
            const yTop = y(w.workouts);
            // Rounded top only; square on the baseline.
            const d =
              h > 0
                ? `M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`
                : "";
            return (
              <g key={w.weekStart}>
                {d && <path d={d} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.45} />}
                {i === weeks.length - 1 && w.workouts > 0 && (
                  <text x={cx} y={yTop - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0d1117">
                    {w.workouts}
                  </text>
                )}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#5d6470">
                  {w.label}
                </text>
                {/* Hit target: the whole column, bigger than the bar. */}
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
        {weeks[shown] && (
          <div className="pointer-events-none mt-1 flex justify-between rounded-lg bg-canvas px-3 py-2 text-xs">
            <span className="text-muted">Week of {weeks[shown].label}</span>
            <span>
              <strong>{weeks[shown].workouts}</strong> workout{weeks[shown].workouts === 1 ? "" : "s"}
              {weeks[shown].volumeKg > 0 && <span className="text-muted"> · {Math.round(weeks[shown].volumeKg).toLocaleString("en-US")} kg lifted</span>}
            </span>
          </div>
        )}
      </div>
      <ul className="sr-only">
        {weeks.map((w) => (
          <li key={w.weekStart}>
            Week of {w.label}: {w.workouts} workouts
          </li>
        ))}
      </ul>
    </div>
  );
}
