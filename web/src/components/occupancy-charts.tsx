"use client";

import { useState } from "react";
import { hourLabel } from "@/lib/hours";

// Charts for live occupancy. One series each (no legend; the title names it),
// one hue: ink for people, lime for "now". Values and labels stay in text ink.
// Every mark has a hover tooltip and the data is also given as text.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Monday first, as people read a week here.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];


// People in the gym each hour today, with the usual number as a faint marker.
export function TodayChart({ today, usual, nowHour }: { today: { hour: number; people: number }[]; usual: Record<number, number>; nowHour: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 5 || (today.find((t) => t.hour === h)?.people ?? 0) > 0);
  const max = Math.max(1, ...today.map((t) => t.people), ...Object.values(usual));
  const value = (h: number) => today.find((t) => t.hour === h)?.people;
  const shown = hover ?? nowHour;

  return (
    <figure>
      <div className="relative">
        <div className="flex h-40 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {hours.map((h) => {
            const v = value(h);
            const u = usual[h] ?? 0;
            return (
              <div
                key={h}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(h)}
                onFocus={() => setHover(h)}
                tabIndex={0}
                aria-label={`${hourLabel(h)}: ${v === undefined ? "later today" : `${v} people`}, usually ${u}`}
              >
                {u > 0 && <span className="absolute inset-x-0 h-[2px] rounded-full bg-muted/40" style={{ bottom: `${(u / max) * 100}%` }} />}
                {v !== undefined && (
                  <span
                    className={`w-full max-w-5 rounded-t-[4px] transition-colors ${h === nowHour ? "bg-brand-strong" : hover === h ? "bg-ink" : "bg-ink/75"}`}
                    style={{ height: `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-[2px] text-[10px] text-muted">
          {hours.map((h) => (
            <span key={h} className="flex-1 text-center">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted" aria-live="polite">
        <b className="text-ink">{hourLabel(shown)}</b>
        {value(shown) === undefined ? " · later today" : ` · ${value(shown)} people`}
        {usual[shown] !== undefined && ` · usually ${usual[shown]}`}
      </figcaption>
    </figure>
  );
}

// Usual people by weekday and hour: darker is busier.
export function BusyHeatmap({ cells, nowDay, nowHour }: { cells: { weekday: number; hour: number; people: number }[]; nowDay: number; nowHour: number }) {
  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null);
  const busy = cells.filter((c) => c.people > 0);
  if (!busy.length) return <p className="text-sm text-muted">Busy hours appear after a week or two of check-ins.</p>;
  const from = Math.min(...busy.map((c) => c.hour));
  const to = Math.max(...busy.map((c) => c.hour));
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(...busy.map((c) => c.people));
  const get = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h)?.people ?? 0;
  // Five steps of one hue, light to dark.
  const step = (v: number) => (v <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  const STEPS = ["bg-canvas", "bg-ink/10", "bg-ink/25", "bg-ink/45", "bg-ink/70", "bg-ink"];
  const peak = busy.reduce((a, b) => (b.people > a.people ? b : a));
  const shown = hover ?? { weekday: nowDay, hour: nowHour };

  return (
    <figure>
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[520px] border-separate border-spacing-[2px]" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map((h) => (
                <th key={h} className="text-[10px] font-normal text-muted">
                  {h % 2 === 0 ? hourLabel(h) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEK_ORDER.map((d) => (
              <tr key={d}>
                <th className={`pr-1 text-left text-xs font-medium ${d === nowDay ? "text-ink" : "text-muted"}`}>{DAYS[d]}</th>
                {hours.map((h) => {
                  const v = get(d, h);
                  const now = d === nowDay && h === nowHour;
                  return (
                    <td
                      key={h}
                      tabIndex={0}
                      onMouseEnter={() => setHover({ weekday: d, hour: h })}
                      onFocus={() => setHover({ weekday: d, hour: h })}
                      aria-label={`${DAYS[d]} ${hourLabel(h)}: usually ${v} people`}
                      className={`h-6 rounded-[4px] ${STEPS[step(v)]} ${now ? "ring-2 ring-brand-strong ring-offset-1" : ""} ${hover?.weekday === d && hover.hour === h ? "outline-2 outline-ink" : ""}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span aria-live="polite">
          <b className="text-ink">
            {DAYS[shown.weekday]} {hourLabel(shown.hour)}
          </b>{" "}
          · usually {get(shown.weekday, shown.hour)} people
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          Quiet
          {STEPS.slice(1).map((s) => (
            <span key={s} className={`size-3 rounded-[3px] ${s}`} />
          ))}
          Busy · busiest {DAYS[peak.weekday]} {hourLabel(peak.hour)}
        </span>
      </figcaption>
    </figure>
  );
}
