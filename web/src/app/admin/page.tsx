import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, Logo, PageHeader, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { PageTabs, activeTab } from "@/components/page-tabs";
import { formatDate, formatDateTime, formatUSD, hoursAgoIso, todayIn } from "@/lib/format";
import { SUBSCRIPTION_STATUS, formatPrice, subscriptionStatus, type Pricing } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import { platformSettings } from "@/lib/subscription";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { extendTrial, openGymAsSupport, recordSubscriptionPayment, setGymSuspended } from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { DailyChart } from "./daily-chart";
import { BroadcastForm, ExtendTrialForm, PlatformSettingsForm, PricingForm, PruneForm, RecordPaymentForm, SuspendForm, WhatsAppKeysForm } from "./forms";
import {
  ADMIN_TZ,
  EMPTY_TOTALS,
  RankedBars,
  StatTile,
  TableCard,
  compact,
  countryName,
  tdClass,
  thClass,
  theadClass,
  timeAgo,
  type Monitoring,
} from "./widgets";

export const metadata: Metadata = { title: "Super admin" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "traffic", label: "Traffic" },
  { id: "logins", label: "Logins" },
  { id: "errors", label: "Errors" },
  { id: "gyms", label: "Gyms" },
  { id: "revenue", label: "Revenue & pricing" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((t) => t.id);
const RANGES = [7, 30, 90] as const;

// Gymix's own console: traffic, logins, errors, gyms, revenue and pricing.
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <span className="flex items-center gap-3">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-ink">
              <ShieldCheck className="size-3.5" /> Super admin
            </span>
          </span>
          <div className="flex items-center gap-1">
            <Suspense>
              <MyGymLink />
            </Suspense>
            <form action={signOut}>
              <button className="h-9 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8">
        <Suspense fallback={<Skeleton className="h-[40rem]" />}>
          <Console searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Console({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const tab = activeTab(params.tab, TAB_IDS) as Tab;
  const days = RANGES.find((r) => String(r) === params.range) ?? 30;
  const base = `/admin?range=${days}`;

  return (
    <>
      <PageHeader
        title="Control center"
        description="Everything happening on Gymix. Members' personal data stays private to each gym."
        action={
          <div className="flex gap-1 rounded-xl bg-line/70 p-1 text-sm" aria-label="Period">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?range=${r}&tab=${tab}`}
                scroll={false}
                replace
                className={`rounded-lg px-3 py-1.5 font-medium ${r === days ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {r} days
              </Link>
            ))}
          </div>
        }
      />
      <PageTabs tabs={[...TABS]} active={tab} base={base} />
      <Suspense key={`${tab}-${days}`} fallback={<Skeleton className="h-96" />}>
        <TabBody tab={tab} days={days} />
      </Suspense>
    </>
  );
}

async function TabBody({ tab, days }: { tab: Tab; days: number }) {
  switch (tab) {
    case "overview":
      return <Overview days={days} />;
    case "traffic":
      return <Traffic days={days} />;
    case "logins":
      return <Logins days={days} />;
    case "errors":
      return <Errors days={days} />;
    case "gyms":
      return <Gyms />;
    case "revenue":
      return <Revenue days={days} />;
  }
}

// ---------------------------------------------------------------- data

async function monitoring(days: number): Promise<Monitoring> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_monitoring", { p_days: days });
  const m = (data ?? {}) as Partial<Monitoring>;
  return {
    days,
    series: m.series ?? [],
    totals: { ...EMPTY_TOTALS, ...m.totals },
    previous: { ...EMPTY_TOTALS, ...m.previous },
    top_pages: m.top_pages ?? [],
    referrers: m.referrers ?? [],
    countries: m.countries ?? [],
    devices: m.devices ?? [],
    browsers: m.browsers ?? [],
    request_types: m.request_types ?? [],
    top_routes: m.top_routes ?? [],
    login_methods: m.login_methods ?? [],
    error_groups: m.error_groups ?? [],
    stored_events: m.stored_events ?? 0,
    oldest_event: m.oldest_event ?? null,
  };
}

async function recentEvents(kinds: string[], limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_events", { p_kinds: kinds, p_limit: limit });
  return data ?? [];
}

async function gymRows(pricing: Pricing) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_gym_overview");
  const today = todayIn(ADMIN_TZ);
  return (data ?? []).map((g) => ({
    ...g,
    sub: subscriptionStatus(g.trial_ends_at, g.paid_until, today, pricing.graceDays, Boolean(g.suspended_at)),
  }));
}
type GymRow = Awaited<ReturnType<typeof gymRows>>[number];

function business(rows: GymRow[], pricing: Pricing) {
  const paying = rows.filter((g) => g.sub === "active").length;
  return {
    paying,
    trial: rows.filter((g) => g.sub === "trial").length,
    attention: rows.filter((g) => g.sub === "grace" || g.sub === "expired").length,
    mrr: paying * pricing.priceUsd,
    members: rows.reduce((n, g) => n + g.members, 0),
  };
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  page: "Page loads",
  navigation: "In-app navigation",
  action: "Form submissions (server actions)",
  api: "API & routes",
};

// ---------------------------------------------------------------- overview

async function Overview({ days }: { days: number }) {
  const pricing = await getPricing();
  const [m, rows] = await Promise.all([monitoring(days), gymRows(pricing)]);
  const b = business(rows, pricing);
  const { totals: t, previous: p } = m;
  const today = todayIn(ADMIN_TZ);
  const soon = rows.filter((g) => g.sub === "trial" && g.trial_ends_at <= addDaysIso(today, 3));
  const attention = rows.filter((g) => g.sub === "grace" || g.sub === "expired" || g.sub === "suspended");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Monthly recurring revenue" value={formatUSD(b.mrr)} hint={`${b.paying} paying × ${formatPrice(pricing.priceUsd)}`} />
        <StatTile label="Paying gyms" value={String(b.paying)} hint={`of ${rows.length} gyms`} />
        <StatTile label="On free trial" value={String(b.trial)} hint={soon.length ? `${soon.length} ending within 3 days` : undefined} />
        <StatTile label="Payment due or ended" value={String(b.attention)} hint="Follow up with these owners" />
        <StatTile label="Members on Gymix" value={compact(b.members)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Visitors" value={compact(t.visitors)} current={t.visitors} previous={p.visitors} />
        <StatTile label="Page views" value={compact(t.views)} current={t.views} previous={p.views} />
        <StatTile label="Logins" value={compact(t.logins)} current={t.logins} previous={p.logins} />
        <StatTile label="Sign-ups" value={compact(t.signups)} current={t.signups} previous={p.signups} />
        <StatTile label="Failed logins" value={compact(t.failed_logins)} current={t.failed_logins} previous={p.failed_logins} upIsGood={false} />
        <StatTile label="Errors" value={compact(t.errors)} current={t.errors} previous={p.errors} upIsGood={false} />
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Activity per day</h2>
        <DailyChart points={m.series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <TableCard title="Needs attention">
          {!attention.length && !soon.length ? (
            <EmptyState>All gyms are in good standing.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {[...attention, ...soon].map((g) => (
                <li key={g.gym_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted">
                      {g.owner_name || g.owner_email}
                      {g.owner_phone ? ` · ${g.owner_phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={SUBSCRIPTION_STATUS[g.sub].tone}>{SUBSCRIPTION_STATUS[g.sub].label}</Badge>
                    <p className="mt-1 text-xs text-muted">
                      {g.sub === "trial" ? `Trial ends ${formatDate(g.trial_ends_at)}` : g.sub === "suspended" ? "Suspended" : `Ended ${formatDate(g.paid_until ?? g.trial_ends_at)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TableCard>

        <TableCard title="Latest errors" action={<Link href={`/admin?range=${days}&tab=errors`} className="text-sm text-muted underline underline-offset-4 hover:text-ink">All errors</Link>}>
          {!m.error_groups.length ? (
            <EmptyState>No errors in the last {days} days.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {m.error_groups.slice(0, 6).map((e) => (
                <li key={`${e.source}-${e.message}`} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.message}</p>
                    <p className="truncate text-xs text-muted">
                      {e.source} · {e.last_path ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="font-semibold tabular-nums">{e.occurrences}×</p>
                    <p className="text-muted">{timeAgo(e.last_seen)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TableCard>
      </div>
    </div>
  );
}

function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- traffic

async function Traffic({ days }: { days: number }) {
  const [m, recent] = await Promise.all([monitoring(days), recentEvents(["request"], 100)]);
  const { totals: t, previous: p } = m;
  const viewsPerVisitor = t.visitors ? (t.views / t.visitors).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Visitors" value={compact(t.visitors)} current={t.visitors} previous={p.visitors} />
        <StatTile label="Page views" value={compact(t.views)} current={t.views} previous={p.views} />
        <StatTile label="Views per visitor" value={viewsPerVisitor} />
        <StatTile label="Signed-in users" value={compact(t.signed_in_users)} current={t.signed_in_users} previous={p.signed_in_users} />
        <StatTile label="Requests" value={compact(t.requests)} current={t.requests} previous={p.requests} hint={`${compact(t.bot_requests)} from bots`} />
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Traffic per day</h2>
        <DailyChart points={m.series} initial="visitors" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <RankedBars
          title="Top pages"
          unit="views"
          rows={m.top_pages.map((r) => ({ key: r.path, label: <code className="text-xs">{r.path}</code>, value: r.views, sub: `${r.visitors} visitors` }))}
        />
        <RankedBars
          title="Where visitors come from"
          unit="visits"
          empty="No outside referrers yet (direct visits and WhatsApp links don't send one)."
          rows={m.referrers.map((r) => ({ key: r.referrer, label: r.referrer, value: r.visits }))}
        />
        <RankedBars title="Countries" unit="visitors" rows={m.countries.map((r) => ({ key: r.country, label: countryName(r.country), value: r.visitors }))} />
        <RankedBars
          title="Devices"
          unit="visitors"
          rows={m.devices.map((r) => ({ key: r.device, label: r.device[0].toUpperCase() + r.device.slice(1), value: r.visitors }))}
        />
        <RankedBars title="Browsers" unit="visitors" rows={m.browsers.map((r) => ({ key: r.browser, label: r.browser, value: r.visitors }))} />
        <RankedBars
          title="Request types"
          unit="requests"
          rows={m.request_types.map((r) => ({ key: r.request_type ?? "other", label: REQUEST_TYPE_LABELS[r.request_type] ?? "Other", value: r.requests }))}
        />
      </div>

      <TableCard title="Busiest routes">
        {!m.top_routes.length ? (
          <EmptyState>No requests recorded yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Path</th>
                  <th className={`${thClass} text-right`}>Requests</th>
                  <th className={`${thClass} text-right`}>Distinct callers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.top_routes.map((r) => (
                  <tr key={`${r.method} ${r.path}`}>
                    <td className={tdClass}>
                      <Badge tone={r.method === "POST" ? "amber" : "gray"}>{r.method}</Badge>
                    </td>
                    <td className={tdClass}>
                      <code className="text-xs">{r.path}</code>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.requests.toLocaleString("en-US")}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.callers.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      <TableCard title="Live request log" action={<span className="text-xs text-muted">Latest 100</span>}>
        {!recent.length ? (
          <EmptyState>No requests recorded yet.</EmptyState>
        ) : (
          <div className="max-h-[32rem] overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={`${theadClass} sticky top-0`}>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Request</th>
                  <th className={thClass}>Who</th>
                  <th className={thClass}>Where</th>
                  <th className={thClass}>Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((e) => (
                  <tr key={e.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`} title={formatDateTime(e.created_at, ADMIN_TZ)}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className={tdClass}>
                      <span className="mr-2 text-xs font-semibold text-muted">{e.method}</span>
                      <code className="text-xs">{e.path}</code>
                      <span className="ml-2 text-xs text-muted">{REQUEST_TYPE_LABELS[e.request_type] ?? ""}</span>
                    </td>
                    <td className={tdClass}>{e.user_email ? <span title={e.user_name ?? ""}>{e.user_email}</span> : <span className="text-muted">Visitor</span>}</td>
                    <td className={`${tdClass} text-muted`}>{countryName(e.country)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>
                      {e.device ?? "—"} · {e.browser ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
    </div>
  );
}

// ---------------------------------------------------------------- logins

async function Logins({ days }: { days: number }) {
  const [m, logins, failures] = await Promise.all([
    monitoring(days),
    recentEvents(["login", "signup"], 150),
    recentEvents(["login_failed"], 150),
  ]);
  const { totals: t, previous: p } = m;

  // Possible password guessing: many failures from one IP in the last 24 hours.
  const dayAgo = new Date(hoursAgoIso(24)).getTime();
  const byIp = new Map<string, { count: number; tried: Set<string>; country: string | null }>();
  for (const f of failures) {
    if (!f.ip || new Date(f.created_at).getTime() < dayAgo) continue;
    const entry = byIp.get(f.ip) ?? { count: 0, tried: new Set<string>(), country: f.country };
    entry.count += 1;
    if (f.message) entry.tried.add(f.message);
    byIp.set(f.ip, entry);
  }
  const suspicious = [...byIp.entries()].filter(([, v]) => v.count >= 5).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Successful logins" value={compact(t.logins)} current={t.logins} previous={p.logins} />
        <StatTile label="Failed logins" value={compact(t.failed_logins)} current={t.failed_logins} previous={p.failed_logins} upIsGood={false} />
        <StatTile label="New accounts" value={compact(t.signups)} current={t.signups} previous={p.signups} />
        <StatTile
          label="Login success rate"
          value={t.logins + t.failed_logins ? `${Math.round((t.logins / (t.logins + t.failed_logins)) * 100)}%` : "—"}
        />
      </div>

      {suspicious.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Possible password guessing in the last 24 hours</p>
            <ul className="mt-1 space-y-0.5">
              {suspicious.map(([ip, v]) => (
                <li key={ip}>
                  <code>{ip}</code> ({countryName(v.country)}): {v.count} failed attempts on {v.tried.size} login{v.tried.size === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Logins per day</h2>
          <DailyChart points={m.series} initial="logins" />
        </Card>
        <RankedBars
          title="How people log in"
          unit="logins"
          rows={m.login_methods.map((r) => ({ key: r.method, label: r.method[0].toUpperCase() + r.method.slice(1), value: r.logins }))}
        />
      </div>

      <TableCard title="Recent logins and sign-ups">
        {!logins.length ? (
          <EmptyState>No logins recorded yet.</EmptyState>
        ) : (
          <div className="max-h-[32rem] overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={`${theadClass} sticky top-0`}>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Event</th>
                  <th className={thClass}>IP</th>
                  <th className={thClass}>Where</th>
                  <th className={thClass}>Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logins.map((e) => (
                  <tr key={e.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`} title={formatDateTime(e.created_at, ADMIN_TZ)}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium">{e.user_name || "—"}</p>
                      <p className="text-xs text-muted">{e.user_email}</p>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={e.kind === "signup" ? "blue" : "green"}>{e.kind === "signup" ? "Sign-up" : "Login"}</Badge>
                      <span className="ml-2 text-xs text-muted">{e.message}</span>
                    </td>
                    <td className={`${tdClass} text-xs text-muted`}>
                      <code>{e.ip ?? "—"}</code>
                    </td>
                    <td className={`${tdClass} text-muted`}>{countryName(e.country)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>
                      {e.device ?? "—"} · {e.browser ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      <TableCard title="Failed logins">
        {!failures.length ? (
          <EmptyState>No failed logins.</EmptyState>
        ) : (
          <div className="max-h-[32rem] overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={`${theadClass} sticky top-0`}>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Login tried</th>
                  <th className={thClass}>Reason</th>
                  <th className={thClass}>IP</th>
                  <th className={thClass}>Where</th>
                  <th className={thClass}>Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {failures.map((e) => {
                  const d = (e.detail ?? {}) as { reason?: string; via?: string };
                  return (
                    <tr key={e.id}>
                      <td className={`${tdClass} whitespace-nowrap text-muted`} title={formatDateTime(e.created_at, ADMIN_TZ)}>
                        {timeAgo(e.created_at)}
                      </td>
                      <td className={tdClass}>
                        <p className="font-medium">{e.message ?? "—"}</p>
                        {d.via && <p className="text-xs text-muted">by {d.via}</p>}
                      </td>
                      <td className={tdClass}>
                        <Badge tone="red">{d.reason ?? "failed"}</Badge>
                      </td>
                      <td className={`${tdClass} text-xs text-muted`}>
                        <code>{e.ip ?? "—"}</code>
                      </td>
                      <td className={`${tdClass} text-muted`}>{countryName(e.country)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>
                        {e.device ?? "—"} · {e.browser ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
    </div>
  );
}

// ---------------------------------------------------------------- errors

async function Errors({ days }: { days: number }) {
  const [m, recent] = await Promise.all([monitoring(days), recentEvents(["error"], 50)]);
  const { totals: t, previous: p } = m;
  const server = m.error_groups.filter((e) => e.source === "server").reduce((n, e) => n + e.occurrences, 0);
  const browser = m.error_groups.filter((e) => e.source === "browser").reduce((n, e) => n + e.occurrences, 0);
  const errorRate = t.requests ? ((t.errors / t.requests) * 100).toFixed(2) : "0";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Errors" value={compact(t.errors)} current={t.errors} previous={p.errors} upIsGood={false} />
        <StatTile label="Error rate" value={`${errorRate}%`} hint="Errors per request" />
        <StatTile label="Server errors" value={compact(server)} hint="Pages, actions, routes" />
        <StatTile label="Browser errors" value={compact(browser)} hint="Crashes on people's phones" />
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Errors per day</h2>
        <DailyChart points={m.series} initial="errors" />
      </Card>

      <TableCard title="Errors grouped by message">
        {!m.error_groups.length ? (
          <EmptyState>No errors in the last {days} days.</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Error</th>
                  <th className={thClass}>Source</th>
                  <th className={`${thClass} text-right`}>Times</th>
                  <th className={`${thClass} text-right`}>People hit</th>
                  <th className={thClass}>First seen</th>
                  <th className={thClass}>Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.error_groups.map((e) => (
                  <tr key={`${e.source}-${e.message}`}>
                    <td className={`${tdClass} max-w-md`}>
                      <p className="break-words font-medium">{e.message}</p>
                      {e.last_path && <code className="text-xs text-muted">{e.last_path}</code>}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={e.source === "server" ? "red" : "amber"}>{e.source}</Badge>
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{e.occurrences}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{e.affected}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(e.first_seen, ADMIN_TZ)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{timeAgo(e.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      <TableCard title="Latest errors with details" action={<span className="text-xs text-muted">Latest 50</span>}>
        {!recent.length ? (
          <EmptyState>No errors recorded.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((e) => {
              const d = (e.detail ?? {}) as { source?: string; digest?: string; route?: string; route_type?: string; stack?: string };
              return (
                <li key={e.id}>
                  <details className="group px-5 py-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{e.message}</p>
                        <p className="text-xs text-muted">
                          {d.source ?? "server"}
                          {d.route_type ? ` · ${d.route_type}` : ""} · <code>{e.method} {e.path}</code>
                          {e.user_email ? ` · ${e.user_email}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted" title={formatDateTime(e.created_at, ADMIN_TZ)}>
                        {timeAgo(e.created_at)}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2 text-xs">
                      <p className="text-muted">
                        {d.route && <>Route file: <code>{d.route}</code> · </>}
                        {d.digest && <>Digest: <code>{d.digest}</code> · </>}
                        {countryName(e.country)} · {e.device ?? "—"} · {e.browser ?? "—"}
                      </p>
                      {d.stack && <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-[11px] leading-relaxed text-white/80">{d.stack}</pre>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </TableCard>
    </div>
  );
}

// ---------------------------------------------------------------- gyms

async function Gyms() {
  const pricing = await getPricing();
  const rows = await gymRows(pricing);
  const totals = [
    { label: "Gyms", value: String(rows.length) },
    { label: "Members", value: compact(rows.reduce((n, g) => n + g.members, 0)) },
    { label: "Active memberships", value: compact(rows.reduce((n, g) => n + g.active_members, 0)) },
    { label: "Check-ins (30 days)", value: compact(rows.reduce((n, g) => n + g.checkins_30d, 0)) },
    { label: "Collected by gyms (30 days)", value: formatUSD(rows.reduce((n, g) => n + Number(g.collected_30d), 0)) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {totals.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Send a notification</h2>
          <p className="mb-4 text-sm text-muted">Maintenance, new features, anything every gym should know. It lands in their bell.</p>
          <BroadcastForm />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">WhatsApp (Gymix number)</h2>
          <p className="mb-4 text-sm text-muted">Renewal reminders, payment receipts and new-member logins go out from this number for every gym.</p>
          <WhatsAppKeys />
        </Card>
      </div>
      <TableCard title="All gyms">
        {!rows.length ? (
          <EmptyState>No gyms yet. They appear here as owners sign up.</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Gym</th>
                  <th className={thClass}>Owner</th>
                  <th className={thClass}>Subscription</th>
                  <th className={`${thClass} text-right`}>Staff</th>
                  <th className={`${thClass} text-right`}>Members</th>
                  <th className={`${thClass} text-right`}>Active</th>
                  <th className={`${thClass} text-right`}>Check-ins 30d</th>
                  <th className={`${thClass} text-right`}>Collected 30d</th>
                  <th className={thClass}>Last check-in</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((g) => (
                  <tr key={g.gym_id} className="hover:bg-canvas/50">
                    <td className={tdClass}>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted">since {formatDate(g.created_at)}</p>
                    </td>
                    <td className={tdClass}>
                      <p>{g.owner_name || "—"}</p>
                      <p className="text-xs text-muted">{g.owner_email}</p>
                      {g.owner_phone && <p className="text-xs text-muted">{g.owner_phone}</p>}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={SUBSCRIPTION_STATUS[g.sub].tone}>{SUBSCRIPTION_STATUS[g.sub].label}</Badge>
                      <p className="mt-1 text-xs text-muted">
                        {g.sub === "suspended"
                          ? g.suspended_reason || `Since ${formatDate(g.suspended_at)}`
                          : g.paid_until
                            ? `Paid until ${formatDate(g.paid_until)}`
                            : `Trial until ${formatDate(g.trial_ends_at)}`}
                      </p>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{g.staff}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{g.members}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{g.active_members}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{g.checkins_30d}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatUSD(g.collected_30d)}</td>
                    <td className={`${tdClass} text-muted`}>{g.last_checkin_at ? formatDate(g.last_checkin_at) : "Never"}</td>
                    <td className={tdClass}>
                      <div className="flex justify-end gap-2">
                        <form action={openGymAsSupport.bind(null, g.gym_id)}>
                          <button title="Open their dashboard as the owner, to help them" className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium whitespace-nowrap">
                            Open dashboard
                          </button>
                        </form>
                        <Dialog
                          label="Record payment"
                          title={`Payment from ${g.name}`}
                          description={`${formatPrice(pricing.priceUsd)} a month. Extends their subscription from today or its current end, whichever is later.`}
                          triggerClassName="h-8 px-3 text-xs whitespace-nowrap"
                        >
                          <RecordPaymentForm action={recordSubscriptionPayment.bind(null, g.gym_id)} price={pricing.priceUsd} />
                        </Dialog>
                        <Dialog label="Extend trial" title={`Extend ${g.name}'s trial`} variant="secondary" triggerClassName="h-8 px-3 text-xs whitespace-nowrap">
                          <ExtendTrialForm action={extendTrial.bind(null, g.gym_id)} />
                        </Dialog>
                        {g.suspended_at ? (
                          <Dialog label="Reopen" title={`Reopen ${g.name}`} variant="secondary" triggerClassName="h-8 px-3 text-xs whitespace-nowrap">
                            <SuspendForm action={setGymSuspended.bind(null, g.gym_id, false)} suspend={false} />
                          </Dialog>
                        ) : (
                          <Dialog
                            label="Suspend"
                            title={`Suspend ${g.name}`}
                            description="Locks their staff dashboard straight away, like an ended subscription. Their members keep using the app. Nothing is deleted."
                            variant="danger"
                            triggerClassName="h-8 px-3 text-xs whitespace-nowrap"
                          >
                            <SuspendForm action={setGymSuspended.bind(null, g.gym_id, true)} suspend />
                          </Dialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
    </div>
  );
}

// ---------------------------------------------------------------- revenue & pricing

async function Revenue({ days }: { days: number }) {
  const pricing = await getPricing();
  const supabase = await createClient();
  const [rows, settings, { data: payments }, m] = await Promise.all([
    gymRows(pricing),
    platformSettings(),
    supabase.rpc("admin_platform_payments", { p_limit: 300 }),
    monitoring(days),
  ]);
  const b = business(rows, pricing);
  const since = new Date(hoursAgoIso(days * 24)).getTime();
  const all = payments ?? [];
  const inRange = all.filter((x) => new Date(x.created_at).getTime() >= since);
  const collected = inRange.reduce((n, x) => n + Number(x.amount_usd), 0);
  const lifetime = all.reduce((n, x) => n + Number(x.amount_usd), 0);

  // Collected per month, last 12 months (ranked bars would reorder time, so keep month order).
  const months: { key: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), value: 0 });
  }
  for (const x of all) {
    const mo = months.find((mm) => mm.key === x.created_at.slice(0, 7));
    if (mo) mo.value += Number(x.amount_usd);
  }
  const maxMonth = Math.max(1, ...months.map((mm) => mm.value));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Monthly recurring revenue" value={formatUSD(b.mrr)} hint={`${b.paying} paying gyms`} />
        <StatTile label="Yearly run rate" value={formatUSD(b.mrr * 12)} />
        <StatTile label={`Collected (last ${days} days)`} value={formatUSD(collected)} hint={`${inRange.length} payments`} />
        <StatTile label="Collected all time" value={formatUSD(lifetime)} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Pricing</h2>
        <p className="mb-4 text-sm text-muted">
          One plan for every gym. Changes show straight away on the landing page, pricing page, sign-up and every owner&apos;s
          Subscription tab. Gyms already on a trial keep their current end date.
        </p>
        <PricingForm priceUsd={pricing.priceUsd} trialDays={pricing.trialDays} graceDays={pricing.graceDays} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Collected per month</h2>
          <p className="mb-4 text-sm text-muted">Subscription payments recorded, last 12 months.</p>
          <ul className="space-y-2">
            {months.map((mo) => (
              <li key={mo.key} className="grid grid-cols-[3.5rem_1fr_5rem] items-center gap-3 text-sm" title={`${mo.label}: ${formatUSD(mo.value)}`}>
                <span className="text-muted">{mo.label}</span>
                <span className="h-2 rounded-full bg-canvas">
                  {mo.value > 0 && <span className="block h-2 rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(2, (mo.value / maxMonth) * 100)}%` }} />}
                </span>
                <span className="text-right tabular-nums">{formatUSD(mo.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">How gyms pay you</h2>
          <p className="mb-4 text-sm text-muted">Record each payment on the Gyms tab to extend that gym.</p>
          <PlatformSettingsForm instructions={settings.instructions} whatsapp={settings.whatsapp} />
        </Card>
      </div>

      <TableCard title="Payment history">
        {!all.length ? (
          <EmptyState>No payments recorded yet.</EmptyState>
        ) : (
          <div className="max-h-[32rem] overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className={`${theadClass} sticky top-0`}>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Gym</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>Months</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Paid until</th>
                  <th className={thClass}>Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.map((x) => (
                  <tr key={x.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDate(x.created_at)}</td>
                    <td className={tdClass}>
                      <p className="font-medium">{x.gym_name}</p>
                      {x.note && <p className="text-xs text-muted">{x.note}</p>}
                    </td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatUSD(x.amount_usd)}</td>
                    <td className={tdClass}>{x.months}</td>
                    <td className={tdClass}>{x.method}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDate(x.paid_until)}</td>
                    <td className={`${tdClass} text-muted`}>{x.recorded_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      <Card className="p-5">
        <h2 className="font-semibold">Monitoring data</h2>
        <p className="mb-4 text-sm text-muted">
          {m.stored_events.toLocaleString("en-US")} events stored
          {m.oldest_event ? `, the oldest from ${formatDate(m.oldest_event)}` : ""}. Delete old ones to keep the database small.
        </p>
        <PruneForm />
      </Card>
    </div>
  );
}

// The super admin's own gym, if they run one; otherwise a way to create one.
async function MyGymLink() {
  const viewer = await requirePlatformAdmin();
  const hasGym = viewer.memberships.length > 0;
  return (
    <Link
      href={hasGym ? "/dashboard" : "/onboarding"}
      className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
    >
      {hasGym ? "My gym dashboard" : "Create a gym"}
    </Link>
  );
}

async function WhatsAppKeys() {
  const { data } = await createAdminClient().from("platform_secrets").select("whatsapp_token, whatsapp_phone_number_id").maybeSingle();
  const token = data?.whatsapp_token ?? "";
  return <WhatsAppKeysForm tokenHint={token ? token.slice(-4) : null} phoneNumberId={data?.whatsapp_phone_number_id ?? ""} />;
}
