import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import type { DailyPoint } from "./daily-chart";

export const ADMIN_TZ = "Asia/Beirut";

export type Totals = {
  views: number;
  visitors: number;
  signed_in_users: number;
  logins: number;
  failed_logins: number;
  signups: number;
  errors: number;
  requests: number;
  bot_requests: number;
};

export type Monitoring = {
  days: number;
  series: DailyPoint[];
  totals: Totals;
  previous: Totals;
  top_pages: { path: string; views: number; visitors: number }[];
  referrers: { referrer: string; visits: number }[];
  countries: { country: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  browsers: { browser: string; visitors: number }[];
  request_types: { request_type: string; requests: number }[];
  top_routes: { method: string; path: string; requests: number; callers: number }[];
  login_methods: { method: string; logins: number }[];
  error_groups: {
    message: string;
    source: string;
    occurrences: number;
    affected: number;
    last_seen: string;
    first_seen: string;
    last_path: string | null;
  }[];
  stored_events: number;
  oldest_event: string | null;
};

export const EMPTY_TOTALS: Totals = {
  views: 0,
  visitors: 0,
  signed_in_users: 0,
  logins: 0,
  failed_logins: 0,
  signups: 0,
  errors: 0,
  requests: 0,
  bot_requests: 0,
};

export function compact(n: number) {
  return n < 10_000 ? n.toLocaleString("en-US") : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string | null) {
  if (!code || code === "??") return "Unknown";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// A number with its change against the previous period of the same length.
// Green/red follows whether the change is good (more errors is bad).
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  hint,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  upIsGood?: boolean;
  hint?: string;
}) {
  let delta: ReactNode = null;
  if (current !== undefined && previous !== undefined) {
    if (previous === 0 && current === 0) {
      delta = <span className="text-muted">No change</span>;
    } else if (previous === 0) {
      delta = <span className="text-muted">New this period</span>;
    } else {
      const pct = Math.round(((current - previous) / previous) * 100);
      const up = pct > 0;
      const good = pct === 0 ? null : up === upIsGood;
      const Icon = up ? ArrowUpRight : ArrowDownRight;
      delta = (
        <span className={`inline-flex items-center gap-0.5 font-medium ${good === null ? "text-muted" : good ? "text-success" : "text-danger"}`}>
          {pct !== 0 && <Icon className="size-3.5" aria-hidden />}
          {pct > 0 ? "+" : ""}
          {pct}%<span className="font-normal text-muted">&nbsp;vs previous</span>
        </span>
      );
    }
  }
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {(delta || hint) && <p className="mt-1 text-xs">{delta ?? <span className="text-muted">{hint}</span>}</p>}
    </Card>
  );
}

// Ranked horizontal bars, largest first, one hue. Doubles as the table view:
// every row prints its label and exact value.
export function RankedBars({
  title,
  rows,
  unit,
  empty = "Nothing recorded yet.",
}: {
  title: string;
  rows: { label: ReactNode; value: number; key: string; sub?: string }[];
  unit: string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className="overflow-hidden">
      <SectionTitle>{title}</SectionTitle>
      {!rows.length ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="space-y-2.5 px-5 pb-5">
          {rows.map((r) => (
            <li key={r.key} title={`${r.value.toLocaleString("en-US")} ${unit}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums font-medium">
                  {r.value.toLocaleString("en-US")}
                  {r.sub && <span className="ml-1 text-xs font-normal text-muted">{r.sub}</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-canvas">
                <div className="h-1.5 rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TableCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Card>
  );
}

export const thClass = "px-4 py-3 font-medium";
export const tdClass = "px-4 py-2.5 align-top";
export const theadClass = "bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted";
