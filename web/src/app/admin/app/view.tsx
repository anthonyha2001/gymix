"use client";

import { useState } from "react";
import { AppWindow, BellRing, ChevronDown, Globe, LayoutGrid, Smartphone, TabletSmartphone } from "lucide-react";
import { AreaChart, BarList, Panel, Stat, ago, fmt } from "../room-ui";

export type AppStats = {
  push: Record<string, number>;
  push_healthy: number;
  pushes_24h: number;
  notifications_24h: number;
  widgets: number;
  platforms_30d: Record<string, number>;
  versions_30d: Record<string, number>;
};
export type CrashRow = { platform: string; crashes: number; people: number; versions: string[] | null };
export type ErrorGroup = { message: string; source: string; occurrences: number; affected: number; last_seen: string; first_seen: string; last_path: string | null };
export type ErrorEvent = { id: number; created_at: string; message: string; path: string; method: string; detail: Record<string, unknown> | null; user_email: string | null; device: string | null; browser: string | null };

const PLATFORMS = [
  { id: "ios-app", label: "iPhone app", icon: Smartphone },
  { id: "android-app", label: "Android app", icon: TabletSmartphone },
  { id: "pwa", label: "Installed web app", icon: AppWindow },
  { id: "browser", label: "Browser", icon: Globe },
] as const;
const PUSH = { web: "Installed web app", fcm: "Android app", apns: "iPhone app" } as Record<string, string>;
const PLATFORM_LABEL = { web: "Browser", pwa: "Installed web app", "ios-app": "iPhone app", "android-app": "Android app" } as Record<string, string>;

export function AppView({ stats, crashes, groups, series, recent }: { stats: AppStats | null; crashes: CrashRow[]; groups: ErrorGroup[]; series: { x: string; y: number }[]; recent: ErrorEvent[] }) {
  const pushTotal = Object.values(stats?.push ?? {}).reduce((n, v) => n + Number(v), 0);
  const crashTotal = crashes.reduce((n, c) => n + Number(c.crashes), 0);
  const deliveredShare = stats?.notifications_24h ? Math.round((stats.pushes_24h / stats.notifications_24h) * 100) : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">App & errors</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">The apps, and what goes wrong</h1>
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Phones with push" value={pushTotal} hint={`${fmt(stats?.push_healthy ?? 0)} delivered this month`} />
        <Stat label="Pushes, 24 h" value={stats?.pushes_24h ?? 0} hint={deliveredShare === null ? "of notifications made" : `${deliveredShare}% of notifications`} />
        <Stat label="Widgets in use" value={stats?.widgets ?? 0} hint="refreshed this week" />
        <Stat label="Crashes, 7 days" value={crashTotal} upIsGood={false} hint="on people's devices" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Push by app">
          <BarList rows={Object.entries(stats?.push ?? {}).map(([k, v]) => ({ key: k, label: PUSH[k] ?? k, value: Number(v) }))} empty="Nobody has turned on notifications yet." />
          <p className="mt-4 flex items-center gap-2 text-xs text-white/40">
            <BellRing className="size-3.5" /> Each phone that allowed notifications, by where it gets them.
          </p>
        </Panel>
        <Panel title="Where people use Gymix · 30 days">
          <BarList rows={Object.entries(stats?.platforms_30d ?? {}).map(([k, v]) => ({ key: k, label: PLATFORM_LABEL[k] ?? k, value: Number(v) }))} empty="Fills in as visitors accept analytics." />
        </Panel>
        <Panel title="App versions · 30 days">
          <BarList rows={Object.entries(stats?.versions_30d ?? {}).map(([k, v]) => ({ key: k, label: k.replace(/^(ios-app|android-app|pwa|web)/, (m) => PLATFORM_LABEL[m] ?? m), value: Number(v) }))} empty="Shown once the phone apps are out." />
          <p className="mt-4 flex items-center gap-2 text-xs text-white/40">
            <LayoutGrid className="size-3.5" /> People on each version of the iPhone and Android apps.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel title="Errors per day · 7 days">
          <AreaChart points={series} height={220} label="errors" />
        </Panel>
        <Panel title="Crashes by platform · 7 days">
          <ul className="space-y-2">
            {PLATFORMS.map((p) => {
              const row = crashes.find((c) => c.platform === p.id);
              const n = Number(row?.crashes ?? 0);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <p.icon className="size-4 text-white/45" />
                  <span className="flex-1 text-sm">
                    {p.label}
                    {row?.versions?.length ? <span className="ml-2 text-xs text-white/35">{row.versions.join(", ")}</span> : null}
                  </span>
                  <span className={`text-sm font-black tabular-nums ${n ? "text-rose-300" : "text-white/30"}`}>{n}</span>
                  <span className="w-16 text-right text-xs text-white/40">{row ? `${row.people} people` : "none"}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Grouped by message" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-left text-[11px] tracking-[0.12em] text-white/40 uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Error</th>
                <th className="px-3 py-3 font-semibold">Where</th>
                <th className="px-3 py-3 text-right font-semibold">Times</th>
                <th className="px-3 py-3 text-right font-semibold">People</th>
                <th className="px-5 py-3 text-right font-semibold">Last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {groups.map((g) => (
                <tr key={`${g.source}-${g.message}`} className="transition-colors hover:bg-white/[0.02]">
                  <td className="max-w-md px-5 py-3">
                    <p className="font-medium break-words text-white/90">{g.message}</p>
                    {g.last_path && <code className="text-xs text-white/40">{g.last_path}</code>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.source === "server" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-300"}`}>{g.source === "server" ? "Server" : "Device"}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmt(Number(g.occurrences))}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-white/70">{fmt(Number(g.affected))}</td>
                  <td className="px-5 py-3 text-right text-xs text-white/45">{ago(g.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!groups.length && <p className="py-12 text-center text-sm text-white/40">No errors this week.</p>}
        </div>
      </Panel>

      <Panel title="Latest, with details" pad={false}>
        <ul className="divide-y divide-white/[0.05]">
          {recent.map((e) => (
            <ErrorItem key={e.id} e={e} />
          ))}
          {!recent.length && <li className="px-5 py-10 text-center text-sm text-white/40">Nothing recorded.</li>}
        </ul>
      </Panel>
    </div>
  );
}

function ErrorItem({ e }: { e: ErrorEvent }) {
  const [open, setOpen] = useState(false);
  const d = (e.detail ?? {}) as { source?: string; platform?: string; app_version?: string | null; stack?: string; kind?: string; digest?: string };
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-white/[0.02]">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${d.source === "browser" ? "bg-amber-400" : "bg-rose-400"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white/90">{e.message}</span>
          <span className="block truncate text-xs text-white/40">
            {d.source === "browser" ? (PLATFORM_LABEL[d.platform ?? "web"] ?? "Device") : "Server"}
            {d.app_version ? ` ${d.app_version}` : ""} · <code>{e.path}</code>
            {e.user_email ? ` · ${e.user_email}` : ""} · {ago(e.created_at)}
          </span>
        </span>
        <ChevronDown className={`mt-1 size-4 shrink-0 text-white/30 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <pre className="room-pop mx-5 mb-4 max-h-72 overflow-auto rounded-2xl bg-black/40 p-4 text-[11px] leading-relaxed text-white/70 ring-1 ring-white/[0.06]">
          {d.stack ?? (d.digest ? `Digest ${d.digest}` : "No stack recorded.")}
          {e.browser ? `\n\n${e.device ?? ""} · ${e.browser}` : ""}
        </pre>
      )}
    </li>
  );
}
