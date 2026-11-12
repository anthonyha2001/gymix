"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { AreaChart, BarList, Funnel, Heatmap, Panel, Segmented, Split, Stat, ago, duration, fmt } from "../room-ui";

const RoomMap = dynamic(() => import("../room-map").then((m) => m.RoomMap), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-3xl bg-white/[0.03]" /> });

export type VisitorsData = {
  totals: { sessions: number; visitors: number; new_visitors: number; pageviews: number; avg_active_s: number; median_active_s: number; bounce_rate: number; signed_in: number };
  daily: { day: string; sessions: number; visitors: number; pageviews: number }[];
  pages: { path: string; views: number; sessions: number; avg_active_s: number; avg_scroll: number; clicks: number }[];
  landing: { path: string; n: number; bounce: number }[];
  exits: { path: string; n: number }[];
  sources: { source: string; n: number; visitors: number; avg_active_s: number }[];
  campaigns: { campaign: string; source: string | null; medium: string | null; n: number }[];
  countries: { country: string; n: number; visitors: number }[];
  cities: { city: string; country: string; n: number; lat: number | null; lng: number | null }[];
  devices: Record<string, number>;
  browsers: Record<string, number>;
  os: Record<string, number>;
  platforms: Record<string, number>;
  languages: Record<string, number>;
  screens: Record<string, number>;
  heatmap: { dow: number; hour: number; n: number }[];
  clicks: { label: string; kind: string; path: string | null; n: number }[];
  funnel: { visitors: number; pricing: number; demo: number; signup_page: number; signups: number };
  returning: { new: number; returning: number };
};

export type SessionRow = {
  id: string;
  started_at: string;
  landing_path: string | null;
  exit_path: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  platform: string | null;
  pageviews: number;
  clicks: number;
  active_ms: number;
  is_new: boolean;
  source: string | null;
  utm_campaign: string | null;
  who: string | null;
};

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (c: string) => {
  try {
    return c && c !== "??" ? (COUNTRY.of(c) ?? c) : "Unknown";
  } catch {
    return c;
  }
};
const PLATFORM: Record<string, string> = { web: "Browser", pwa: "Installed web app", "ios-app": "iPhone app", "android-app": "Android app" };
const rows = (o: Record<string, number> | undefined, label: (k: string) => string = (k) => k) =>
  Object.entries(o ?? {})
    .map(([k, v]) => ({ key: k, label: label(k), value: Number(v) }))
    .sort((a, b) => b.value - a.value);

export function VisitorsView({ days, data, sessions, filter }: { days: number; data: VisitorsData | null; sessions: SessionRow[]; filter: { country: string | null; source: string | null } }) {
  const router = useRouter();
  const [tab, setTab] = useState<"devices" | "browsers" | "os" | "platforms" | "languages" | "screens">("devices");
  const t = data?.totals;
  const go = (p: Record<string, string | null>) => {
    const u = new URLSearchParams({ range: String(days) });
    const merged = { country: filter.country, source: filter.source, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    router.push(`/admin/visitors?${u}`, { scroll: false });
  };

  if (!data || !t) {
    return (
      <Panel>
        <p className="py-16 text-center text-white/50">No visitor data yet. It starts once the newest migration is run and visitors accept analytics.</p>
      </Panel>
    );
  }

  const points = data.cities.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng!, label: `${c.city}, ${countryName(c.country)}`, detail: `${c.n} visits`, weight: c.n }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">Visitors</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Who visits, and what they do</h1>
          <p className="mt-1 text-sm text-white/50">Only visitors who accepted analytics. Time counts when they&apos;re actually looking.</p>
        </div>
        <Segmented value={days} options={[7, 30, 90].map((d) => ({ value: d, label: `${d} days` }))} onChange={(d) => go({ range: String(d) })} />
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Stat label="Visitors" value={t.visitors} hint={`${fmt(t.new_visitors)} new`} />
        <Stat label="Visits" value={t.sessions} hint={`${fmt(t.signed_in)} signed in`} />
        <Stat label="Pages viewed" value={t.pageviews} hint={t.sessions ? `${(t.pageviews / t.sessions).toFixed(1)} per visit` : undefined} />
        <Stat label="Time per visit" value={t.avg_active_s} format={duration} hint={`median ${duration(t.median_active_s)}`} />
        <Stat label="Left at once" value={t.bounce_rate} format={(n) => `${n.toFixed(0)}%`} hint="one page, under 10 s" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Panel title="Visits per day">
          <AreaChart points={data.daily.map((d) => ({ x: d.day, y: Number(d.sessions) }))} height={240} label="visits" />
        </Panel>
        <Panel title="From first visit to new gym">
          <Funnel
            steps={[
              { label: "Visited the site", value: data.funnel.visitors },
              { label: "Saw pricing", value: data.funnel.pricing },
              { label: "Opened sign-up or request", value: data.funnel.signup_page },
              { label: "Signed up", value: data.funnel.signups },
            ]}
          />
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">New or returning visits</p>
            <Split a={{ label: "New", value: data.returning.new }} b={{ label: "Returning", value: data.returning.returning }} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Where they come from" action={filter.source && <ClearChip label={filter.source} onClear={() => go({ source: null })} />}>
          <BarList
            rows={data.sources.map((s) => ({ key: s.source, label: <button onClick={() => go({ source: s.source })} className="hover:underline">{s.source}</button>, value: Number(s.n), sub: `${duration(s.avg_active_s)} avg` }))}
          />
        </Panel>
        <Panel title="Campaigns (UTM links)">
          <BarList
            rows={data.campaigns.map((c) => ({ key: `${c.campaign}${c.source}`, label: c.campaign, value: Number(c.n), sub: [c.source, c.medium].filter(Boolean).join(" / ") }))}
            empty="No campaign links yet. Add ?utm_campaign=… to links you post."
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <RoomMap points={points} className="h-[24rem]" />
        <Panel title="Countries" action={filter.country && <ClearChip label={countryName(filter.country)} onClear={() => go({ country: null })} />}>
          <BarList rows={data.countries.map((c) => ({ key: c.country, label: <button onClick={() => go({ country: c.country })} className="hover:underline">{countryName(c.country)}</button>, value: Number(c.n) }))} />
        </Panel>
      </div>

      <Panel title="Pages" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-[11px] tracking-[0.12em] text-white/40 uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Page</th>
                <th className="px-3 py-3 text-right font-semibold">Views</th>
                <th className="px-3 py-3 text-right font-semibold">Time on page</th>
                <th className="w-48 px-3 py-3 font-semibold">Scrolled</th>
                <th className="px-5 py-3 text-right font-semibold">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.pages.map((p, i) => (
                <tr key={p.path} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-2.5">
                    <code className="text-white/85">{p.path}</code>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(Number(p.views))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/75">{duration(Number(p.avg_active_s))}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="room-bar-fill h-full rounded-full bg-brand" style={{ width: `${Number(p.avg_scroll)}%`, animationDelay: `${i * 30}ms` }} />
                      </div>
                      <span className="w-9 text-right text-xs tabular-nums text-white/60">{Number(p.avg_scroll)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-white/75">{fmt(Number(p.clicks))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.pages.length && <p className="py-10 text-center text-sm text-white/40">No pages yet.</p>}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Where visits start">
          <BarList rows={data.landing.map((l) => ({ key: l.path, label: <code>{l.path}</code>, value: Number(l.n), sub: `${l.bounce}% left at once` }))} />
        </Panel>
        <Panel title="Where visits end">
          <BarList rows={data.exits.map((l) => ({ key: l.path, label: <code>{l.path}</code>, value: Number(l.n) }))} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel title="When they visit">
          <Heatmap cells={data.heatmap} unit="visits" />
        </Panel>
        <Panel
          title="Their devices"
          action={
            <select value={tab} onChange={(e) => setTab(e.target.value as typeof tab)} className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white ring-1 ring-white/10 outline-none">
              <option value="devices">Device</option>
              <option value="platforms">App or browser</option>
              <option value="browsers">Browser</option>
              <option value="os">System</option>
              <option value="screens">Screen size</option>
              <option value="languages">Language</option>
            </select>
          }
        >
          <BarList key={tab} rows={rows(data[tab], tab === "platforms" ? (k) => PLATFORM[k] ?? k : (k) => k.charAt(0).toUpperCase() + k.slice(1))} />
        </Panel>
      </div>

      <Panel title="What they click">
        <BarList
          rows={data.clicks.map((c) => ({ key: `${c.label}${c.path}${c.kind}`, label: c.label, value: Number(c.n), sub: `${c.kind === "cta" ? "call to action" : c.kind === "outbound" ? "leaves the site" : c.kind} · ${c.path ?? ""}` }))}
          empty="No clicks recorded yet."
          limit={10}
        />
      </Panel>

      <Panel title={`Latest visits${filter.country || filter.source ? " (filtered)" : ""}`} pad={false}>
        <ul className="room-feed divide-y divide-white/[0.05]">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/visitors/${s.id}`} className="group flex items-center gap-4 px-5 py-3 text-sm transition hover:bg-white/[0.03]">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold ${s.is_new ? "bg-brand/15 text-brand" : "bg-white/[0.06] text-white/60"}`}>{s.is_new ? "NEW" : "BACK"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-white">
                    {s.who ?? ([s.city, s.country && countryName(s.country)].filter(Boolean).join(", ") || "A visitor")}
                    {s.source && <span className="ml-2 text-xs text-white/40">from {s.source}</span>}
                  </span>
                  <span className="block truncate text-xs text-white/45">
                    {s.landing_path} → {s.exit_path} · {s.pageviews} pages · {duration(s.active_ms / 1000)} · {s.device} · {PLATFORM[s.platform ?? "web"]}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-white/35">{ago(s.started_at)}</span>
                <ArrowRight className="size-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            </li>
          ))}
          {!sessions.length && <li className="px-5 py-10 text-center text-sm text-white/40">No visits match.</li>}
        </ul>
      </Panel>
    </div>
  );
}

function ClearChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
      {label} <X className="size-3" />
    </button>
  );
}
