"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, FlaskConical, Inbox, Loader2, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { openGymAsSupport } from "../actions";
import { Panel, ScoreRing, Segmented, Stat, ago, fmt } from "../room-ui";

const RoomMap = dynamic(() => import("../room-map").then((m) => m.RoomMap), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-3xl bg-white/[0.03]" /> });

export type HealthRow = {
  gym_id: string;
  name: string;
  is_lab: boolean;
  created_at: string;
  trial_ends_at: string | null;
  paid_until: string | null;
  suspended: boolean;
  members: number;
  active_members: number;
  checkins_7d: number;
  checkins_prev_7d: number;
  collected_30d: number;
  staff: number;
  last_staff_seen: string | null;
  errors_7d: number;
  open_tickets: number;
  score: number;
  lat: number | null;
  lng: number | null;
};

type Filter = "all" | "risk" | "watch" | "healthy" | "lab";
const band = (s: number) => (s >= 70 ? "healthy" : s >= 40 ? "watch" : "risk");
const toneOf = (s: number) => (s >= 70 ? "good" : s >= 40 ? "warn" : "bad") as "good" | "warn" | "bad";

export function GymsView({ rows, selected }: { rows: HealthRow[]; selected: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const real = rows.filter((r) => !r.is_lab);
  const shown = useMemo(
    () =>
      rows
        .filter((r) => (filter === "lab" ? r.is_lab : !r.is_lab && (filter === "all" || band(r.score) === filter)))
        .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.score - b.score),
    [rows, filter, q],
  );
  const current = selected ? rows.find((r) => r.gym_id === selected) : null;
  const points = real.filter((r) => r.lat != null && r.lng != null).map((r) => ({ lat: r.lat!, lng: r.lng!, label: r.name, detail: `Health ${r.score} · ${r.active_members} members`, tone: toneOf(r.score) }));
  const avg = real.length ? Math.round(real.reduce((n, r) => n + r.score, 0) / real.length) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">Gyms</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">How every gym is doing</h1>
          <p className="mt-1 text-sm text-white/50">Health counts check-ins, payments, staff logging in, members, errors and open tickets.</p>
        </div>
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Gyms" value={real.length} hint={`${rows.length - real.length} lab`} />
        <Stat label="Average health" value={avg} hint="out of 100" />
        <Stat label="At risk" value={real.filter((r) => r.score < 40).length} hint="health under 40" />
        <Stat label="Members on Gymix" value={real.reduce((n, r) => n + r.active_members, 0)} hint="with a running membership" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel
          title={`${shown.length} gyms · weakest first`}
          action={
            <label className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.07]">
              <Search className="size-4 text-white/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-32 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
            </label>
          }
          pad={false}
        >
          <div className="px-5 pb-3">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "risk", label: "At risk" },
                { value: "watch", label: "Watch" },
                { value: "healthy", label: "Healthy" },
                { value: "lab", label: "Lab" },
              ]}
            />
          </div>
          <ul className="room-feed divide-y divide-white/[0.05]">
            {shown.map((r, i) => {
              const d = r.checkins_prev_7d ? Math.round(((r.checkins_7d - r.checkins_prev_7d) / r.checkins_prev_7d) * 100) : null;
              return (
                <li key={r.gym_id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <Link href={`/admin/gyms?gym=${r.gym_id}`} scroll={false} className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 transition sm:grid-cols-[auto_1fr_8rem_7rem_6rem] ${selected === r.gym_id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                    <ScoreRing score={r.score} size={40} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 truncate font-semibold text-white">
                        {r.is_lab && <FlaskConical className="size-3.5 text-white/40" />}
                        {r.name}
                      </span>
                      <span className="block truncate text-xs text-white/45">
                        {r.suspended ? "Suspended" : r.paid_until ? `Paid until ${formatDate(r.paid_until)}` : r.trial_ends_at ? `Trial until ${formatDate(r.trial_ends_at)}` : "Not paying"} · staff seen {ago(r.last_staff_seen)}
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block font-semibold tabular-nums">{fmt(r.checkins_7d)}</span>
                      <span className="flex items-center justify-end gap-0.5 text-[11px] text-white/45">
                        {d === null ? "check-ins, 7 d" : (
                          <>
                            {d >= 0 ? <ArrowUpRight className="size-3 text-emerald-300" /> : <ArrowDownRight className="size-3 text-rose-300" />}
                            <span className={d >= 0 ? "text-emerald-300" : "text-rose-300"}>{Math.abs(d)}%</span> vs last week
                          </>
                        )}
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block font-semibold tabular-nums">{fmt(r.active_members)}</span>
                      <span className="block text-[11px] text-white/45">members</span>
                    </span>
                    <span className="text-right">
                      {r.open_tickets > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                          <Inbox className="size-3" /> {r.open_tickets}
                        </span>
                      ) : (
                        <span className="text-xs text-white/25">no tickets</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
            {!shown.length && <li className="px-5 py-12 text-center text-sm text-white/40">No gyms here.</li>}
          </ul>
        </Panel>

        <div className="space-y-4">
          {current ? <Detail g={current} onClose={() => router.push("/admin/gyms", { scroll: false })} /> : null}
          <RoomMap points={points} className={current ? "h-72" : "h-[34rem]"} zoom={6} />
          <p className="flex items-center justify-center gap-4 text-xs text-white/45">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-400" /> Healthy</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-400" /> Watch</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-400" /> At risk</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ g, onClose }: { g: HealthRow; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [as, setAs] = useState<string | null>(null);
  const enter = (role: "owner" | "manager" | "front_desk") => {
    setAs(role);
    start(() => openGymAsSupport(g.gym_id, role));
  };
  const facts: [string, string][] = [
    ["Members", `${fmt(g.active_members)} of ${fmt(g.members)}`],
    ["Check-ins, 7 d", fmt(g.checkins_7d)],
    ["Collected, 30 d", `$${fmt(Number(g.collected_30d))}`],
    ["Staff", `${g.staff} · seen ${ago(g.last_staff_seen)}`],
    ["Errors, 7 d", String(g.errors_7d)],
    ["Open tickets", String(g.open_tickets)],
  ];
  return (
    <section className="room-pop rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/10">
      <div className="flex items-start gap-4">
        <ScoreRing score={g.score} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{g.name}</p>
          <p className="text-xs text-white/45">On Gymix since {formatDate(g.created_at)}</p>
        </div>
        <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] text-white/40">{k}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">Open it as</p>
      <div className="grid grid-cols-3 gap-2">
        {(["owner", "manager", "front_desk"] as const).map((r) => (
          <button key={r} type="button" disabled={pending} onClick={() => enter(r)} className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${r === "owner" ? "bg-brand text-ink" : "bg-white/[0.06] text-white ring-1 ring-white/10"}`}>
            {pending && as === r ? <Loader2 className="size-3.5 animate-spin" /> : r === "owner" ? <Building2 className="size-3.5" /> : null}
            {r === "front_desk" ? "Front desk" : r[0].toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs">
        <Link href={`/admin/support?view=all`} className="text-white/50 hover:text-white">
          Support tickets
        </Link>
        <Link href={`/admin/reports?tab=gyms`} className="text-white/50 hover:text-white">
          Payments and suspension
        </Link>
      </div>
    </section>
  );
}
