"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/format";

// Revenue per day: one series (the title names it), ink bars, hover for the
// day's revenue and profit. Days without sales show as gaps on the baseline.
export function RevenueChart({ days }: { days: { day: string; revenue: number; profit: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!days.length) return <p className="py-8 text-center text-sm text-muted">No sales in this period.</p>;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const shown = days[hover ?? days.length - 1];
  const every = Math.max(1, Math.ceil(days.length / 8));

  return (
    <figure>
      <div className="flex h-44 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <div
            key={d.day}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            aria-label={`${label(d.day)}: ${formatUSD(d.revenue)} revenue, ${formatUSD(d.profit)} profit`}
            className="flex h-full flex-1 cursor-default items-end justify-center"
          >
            <span
              className={`w-full max-w-8 rounded-t-[4px] transition-colors ${hover === i ? "bg-ink" : "bg-ink/70"}`}
              style={{ height: `${Math.max(d.revenue > 0 ? 2 : 0, (d.revenue / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-muted">
        {days.map((d, i) => (
          <span key={d.day} className="flex-1 truncate text-center">
            {i % every === 0 ? label(d.day) : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-sm text-muted" aria-live="polite">
        <b className="text-ink">{label(shown.day)}</b> · {formatUSD(shown.revenue)} revenue · {formatUSD(shown.profit)} profit
      </figcaption>
    </figure>
  );
}
