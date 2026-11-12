"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Eye, Inbox, LogIn, MousePointerClick, Sparkles, UserPlus } from "lucide-react";
import { liveNow, type LiveData } from "./room-actions";
import { Columns, Panel, Stat, ScoreRing, ago, duration } from "./room-ui";

const RoomMap = dynamic(() => import("./room-map").then((m) => m.RoomMap), { ssr: false, loading: () => <div className="h-[26rem] animate-pulse rounded-3xl bg-white/[0.03]" /> });

export type Attention = {
  requests: number;
  tickets: number;
  errors: number;
  atRisk: { id: string; name: string; score: number }[];
  gyms: number;
  paying: number;
  checkins7d: number;
  checkinsPrev7d: number;
};

const FEED = {
  view: { icon: Eye, label: "Viewed", tone: "text-white/60" },
  cta: { icon: MousePointerClick, label: "Clicked", tone: "text-brand" },
  form: { icon: MousePointerClick, label: "Sent", tone: "text-brand" },
  signup: { icon: Sparkles, label: "Signed up", tone: "text-emerald-300" },
  login: { icon: LogIn, label: "Logged in", tone: "text-sky-300" },
  error: { icon: AlertTriangle, label: "Error", tone: "text-rose-300" },
} as const;

export function LiveRoom({ initial, attention }: { initial: LiveData | null; attention: Attention }) {
  const [live, setLive] = useState(initial);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => liveNow().then((d) => d && setLive(d)).catch(() => {}), 10_000);
    const r = setInterval(() => setTick((n) => n + 1), 30_000); // keeps "2 min ago" honest
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, []);

  const now = useMemo(() => live?.now ?? [], [live]);
  const points = useMemo(() => {
    const groups = new Map<string, { lat: number; lng: number; label: string; n: number }>();
    for (const s of now) {
      if (s.lat == null || s.lng == null) continue;
      const k = `${s.city ?? ""}|${s.country ?? ""}`;
      const g = groups.get(k) ?? { lat: s.lat, lng: s.lng, label: [s.city, s.country].filter(Boolean).join(", ") || "Somewhere", n: 0 };
      g.n += 1;
      groups.set(k, g);
    }
    return [...groups.values()].map((g) => ({ lat: g.lat, lng: g.lng, label: g.label, detail: `${g.n} on the site now`, weight: g.n, live: true }));
  }, [now]);

  // Visitors per minute over the last hour, oldest first.
  const minutes = useMemo(() => {
    const m = new Map((live?.last_hour ?? []).map((x) => [new Date(x.minute).getTime(), x.sessions]));
    // Anchored on the newest minute the server reported (no clock reads here).
    const stamps = [...m.keys()];
    const end = stamps.length ? Math.max(...stamps) : 0;
    if (!end) return [];
    return Array.from({ length: 60 }, (_, i) => {
      const t = end - (59 - i) * 60_000;
      return { v: m.get(t) ?? 0, l: new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" }) };
    });
  }, [live]);

  const delta = attention.checkinsPrev7d ? ((attention.checkins7d - attention.checkinsPrev7d) / attention.checkinsPrev7d) * 100 : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">
            <span className="room-live size-1.5 rounded-full bg-brand" /> Live
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Right now on Gymix</h1>
        </div>
        <p className="text-xs text-white/40">Updates every 10 seconds</p>
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="On the site now" value={now.length} live hint="seen in the last 90 seconds" />
        <Stat label="Visitors today" value={live?.today.visitors ?? 0} hint={`${live?.today.sessions ?? 0} visits`} />
        <Stat label="Pages viewed today" value={live?.today.pageviews ?? 0} />
        <Stat label="Avg. time per visit" value={live?.today.avg_active_s ?? 0} format={duration} hint="actively looking" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <div className="relative">
            <RoomMap points={points} className="h-[26rem]" />
            <div className="pointer-events-none absolute top-4 left-4 rounded-2xl bg-[#0b0f15]/80 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">Where they are</p>
              <p className="text-sm font-semibold">{points.length ? `${points.length} ${points.length === 1 ? "place" : "places"}` : "Nobody right now"}</p>
            </div>
          </div>
          <Panel title="Visitors per minute · last hour">
            <Columns values={minutes.map((m) => m.v)} labels={minutes.map((m) => m.l)} height={72} unit="on the site" />
            <div className="mt-2 flex justify-between text-[10px] text-white/35">
              <span>60 min ago</span>
              <span>now</span>
            </div>
          </Panel>
          <Panel title={`On the site now · ${now.length}`} pad={false}>
            {!now.length ? (
              <p className="px-5 pb-6 text-sm text-white/40">Nobody is on the site this minute.</p>
            ) : (
              <ul className="room-feed divide-y divide-white/[0.05]">
                {now.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/visitors/${s.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-white/[0.03]">
                      <span className="room-live size-2 shrink-0 rounded-full bg-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-white">{s.who ?? ([s.city, s.country].filter(Boolean).join(", ") || "A visitor")}</span>
                        <span className="block truncate text-xs text-white/45">
                          on <code className="text-white/70">{s.path ?? "/"}</code> · {s.pageviews} {s.pageviews === 1 ? "page" : "pages"} · {s.device ?? "device"}
                          {s.source ? ` · from ${s.source}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-white/35">{ago(s.started_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Needs you">
            <ul className="space-y-2">
              <NeedRow href="/admin/clients" icon={UserPlus} label="New requests" n={attention.requests} />
              <NeedRow href="/admin/support" icon={Inbox} label="Unread support" n={attention.tickets} />
              <NeedRow href="/admin/app" icon={AlertTriangle} label="Errors, 24 h" n={attention.errors} bad />
            </ul>
            {attention.atRisk.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">Gyms at risk</p>
                <ul className="space-y-1.5">
                  {attention.atRisk.map((g) => (
                    <li key={g.id}>
                      <Link href={`/admin/gyms?gym=${g.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
                        <span className="truncate text-sm">{g.name}</span>
                        <ScoreRing score={g.score} size={34} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Gyms" value={attention.gyms} hint={`${attention.paying} paying`} />
            <Stat label="Check-ins, 7 d" value={attention.checkins7d} delta={delta} hint="vs week before" />
          </div>
          <Panel title="Live feed · 30 min" pad={false}>
            {!live?.feed.length ? (
              <p className="px-5 pb-6 text-sm text-white/40">Quiet for now.</p>
            ) : (
              <ol className="room-feed max-h-[30rem] divide-y divide-white/[0.05] overflow-auto">
                {live.feed.map((f, i) => {
                  const k = FEED[f.kind as keyof typeof FEED] ?? FEED.view;
                  return (
                    <li key={`${f.at}-${i}`} className="flex items-start gap-3 px-5 py-2.5 text-sm" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <k.icon className={`mt-0.5 size-4 shrink-0 ${k.tone}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-white/85">
                          <span className={k.tone}>{k.label}</span> {f.what}
                        </span>
                        <span className="block text-xs text-white/35">
                          {[f.city, f.country].filter(Boolean).join(", ") || "unknown place"}
                          {f.device ? ` · ${f.device}` : ""} · {ago(f.at)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NeedRow({ href, icon: Icon, label, n, bad = false }: { href: string; icon: typeof Inbox; label: string; n: number; bad?: boolean }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/[0.06] transition hover:bg-white/[0.06]">
        <Icon className={`size-4 ${n ? (bad ? "text-rose-300" : "text-brand") : "text-white/35"}`} />
        <span className="flex-1 text-sm text-white/80">{label}</span>
        <span className={`text-lg font-black tabular-nums ${n ? "text-white" : "text-white/30"}`}>{n}</span>
        <ArrowRight className="size-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </Link>
    </li>
  );
}
