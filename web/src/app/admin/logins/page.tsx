import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { formatDateTime, hoursAgoIso } from "@/lib/format";
import { monitoring, rangeOf, recentEvents } from "../data";
import { Empty, Pill, RangeSwitch, RoomHeader, row, tbody, td, th, thead } from "../room-head";
import { AreaChart, BarList, Panel, Stat } from "../room-ui";
import { ADMIN_TZ, countryName, timeAgo } from "../widgets";

export const metadata: Metadata = { title: "Sign-ins" };

// Who logs in to Gymix, who fails to, and whether someone is guessing passwords.
export default function LoginsPage({ searchParams }: PageProps<"/admin/logins">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <Logins searchParams={searchParams} />
    </Suspense>
  );
}

const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

async function Logins({ searchParams }: { searchParams: PageProps<"/admin/logins">["searchParams"] }) {
  const days = rangeOf((await searchParams).range);
  const [m, logins, failures] = await Promise.all([monitoring(days), recentEvents(["login", "signup"], 150), recentEvents(["login_failed"], 150)]);
  const { totals: t, previous: p } = m;
  const tries = t.logins + t.failed_logins;

  // Possible password guessing: 5+ failures from one IP in the last 24 hours.
  const dayAgo = new Date(hoursAgoIso(24)).getTime();
  const byIp = new Map<string, { count: number; tried: Set<string>; country: string | null }>();
  for (const f of failures) {
    if (!f.ip || new Date(f.created_at).getTime() < dayAgo) continue;
    const e = byIp.get(f.ip) ?? { count: 0, tried: new Set<string>(), country: f.country };
    e.count += 1;
    if (f.message) e.tried.add(f.message);
    byIp.set(f.ip, e);
  }
  const suspicious = [...byIp.entries()].filter(([, v]) => v.count >= 5).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <RoomHeader eyebrow="Sign-ins" title="Who gets in, and who doesn't" description="Staff and member logins across every gym, failed attempts, and password guessing." action={<RangeSwitch base="/admin/logins" days={days} />} />

      {suspicious.length > 0 && (
        <div role="alert" className="room-pop flex items-start gap-3 rounded-3xl bg-amber-400/[0.08] px-5 py-4 text-sm ring-1 ring-amber-300/25">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-200">Possible password guessing in the last 24 hours</p>
            <ul className="mt-1 space-y-0.5 text-white/70">
              {suspicious.map(([ip, v]) => (
                <li key={ip}>
                  <code className="text-white">{ip}</code> ({countryName(v.country)}): {v.count} failed attempts on {v.tried.size} login{v.tried.size === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Logins" value={t.logins} delta={change(t.logins, p.logins)} hint="vs previous period" />
        <Stat label="Failed" value={t.failed_logins} delta={change(t.failed_logins, p.failed_logins)} upIsGood={false} hint="vs previous period" />
        <Stat label="New accounts" value={t.signups} delta={change(t.signups, p.signups)} hint="vs previous period" />
        <Stat label="Success rate" value={tries ? (t.logins / tries) * 100 : 0} format="pct" hint={`${tries.toLocaleString("en-US")} attempts`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Panel title={`Logins per day · ${days} days`}>
          <AreaChart points={m.series.map((d) => ({ x: d.day, y: d.logins }))} height={220} label="logins" />
        </Panel>
        <Panel title="How people log in">
          <BarList rows={m.login_methods.map((r) => ({ key: r.method, label: r.method[0].toUpperCase() + r.method.slice(1), value: r.logins }))} empty="No logins in this period." />
        </Panel>
      </div>

      <Panel title="Recent logins and sign-ups" pad={false}>
        {!logins.length ? (
          <Empty>No logins recorded yet.</Empty>
        ) : (
          <div className="mt-3 max-h-[30rem] overflow-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Person</th>
                  <th className={th}>Event</th>
                  <th className={th}>Where</th>
                  <th className={th}>Device</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {logins.map((e) => (
                  <tr key={e.id} className={row}>
                    <td className={`${td} whitespace-nowrap text-white/50`} title={formatDateTime(e.created_at, ADMIN_TZ)}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className={td}>
                      <p className="font-medium">{e.user_name || "–"}</p>
                      <p className="text-xs text-white/40">{e.user_email}</p>
                    </td>
                    <td className={td}>
                      <Pill tone={e.kind === "signup" ? "info" : "good"}>{e.kind === "signup" ? "Sign-up" : "Login"}</Pill>
                      {e.message && <span className="ml-2 text-xs text-white/40">{e.message}</span>}
                    </td>
                    <td className={`${td} text-white/60`}>
                      {countryName(e.country)}
                      {e.ip && <code className="block text-[11px] text-white/35">{e.ip}</code>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-white/50`}>
                      {e.device ?? "–"} · {e.browser ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Failed attempts" pad={false}>
        {!failures.length ? (
          <Empty>No failed logins.</Empty>
        ) : (
          <div className="mt-3 max-h-[30rem] overflow-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Login tried</th>
                  <th className={th}>Reason</th>
                  <th className={th}>Where</th>
                  <th className={th}>Device</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {failures.map((e) => {
                  const d = (e.detail ?? {}) as { reason?: string; via?: string };
                  return (
                    <tr key={e.id} className={row}>
                      <td className={`${td} whitespace-nowrap text-white/50`} title={formatDateTime(e.created_at, ADMIN_TZ)}>
                        {timeAgo(e.created_at)}
                      </td>
                      <td className={td}>
                        <p className="font-medium">{e.message ?? "–"}</p>
                        {d.via && <p className="text-xs text-white/40">by {d.via}</p>}
                      </td>
                      <td className={td}>
                        <Pill tone="bad">{d.reason ?? "failed"}</Pill>
                      </td>
                      <td className={`${td} text-white/60`}>
                        {countryName(e.country)}
                        {e.ip && <code className="block text-[11px] text-white/35">{e.ip}</code>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-white/50`}>
                        {e.device ?? "–"} · {e.browser ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
