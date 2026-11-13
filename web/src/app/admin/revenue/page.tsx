import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleAlert, CircleCheck, Clock3, PauseCircle } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { formatDate, hoursAgoIso, todayIn } from "@/lib/format";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import { platformSettings } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { addDaysIso, business, gymRows, rangeOf } from "../data";
import { PlatformSettingsForm, PricingForm } from "../forms";
import { Empty, Pill, RangeSwitch, RoomHeader, row, tbody, td, th, thead } from "../room-head";
import { Columns, Panel, Stat } from "../room-ui";
import { ADMIN_TZ } from "../widgets";

export const metadata: Metadata = { title: "Revenue" };

// What Gymix earns: recurring revenue, who pays, who needs a nudge, the price
// and the payment history.
export default function RevenuePage({ searchParams }: PageProps<"/admin/revenue">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <Revenue searchParams={searchParams} />
    </Suspense>
  );
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

async function Revenue({ searchParams }: { searchParams: PageProps<"/admin/revenue">["searchParams"] }) {
  const days = rangeOf((await searchParams).range);
  const pricing = await getPricing();
  const supabase = await createClient();
  const [rows, settings, { data: payments }] = await Promise.all([gymRows(pricing), platformSettings(), supabase.rpc("admin_platform_payments", { p_limit: 300 })]);
  const b = business(rows, pricing);
  const all = payments ?? [];
  const since = new Date(hoursAgoIso(days * 24)).getTime();
  const inRange = all.filter((x) => new Date(x.created_at).getTime() >= since);
  const collected = inRange.reduce((n, x) => n + Number(x.amount_usd), 0);
  const lifetime = all.reduce((n, x) => n + Number(x.amount_usd), 0);

  const today = todayIn(ADMIN_TZ);
  const soon = addDaysIso(today, 3);
  const follow = rows
    .filter((g) => g.sub === "grace" || g.sub === "expired" || g.sub === "suspended" || (g.sub === "trial" && g.trial_ends_at <= soon))
    .sort((a, b) => (a.paid_until ?? a.trial_ends_at).localeCompare(b.paid_until ?? b.trial_ends_at));

  // Collected per month, last 12 months, in month order.
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + k, 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), value: 0 };
  });
  for (const x of all) {
    const mo = months.find((m) => m.key === x.created_at.slice(0, 7));
    if (mo) mo.value += Number(x.amount_usd);
  }
  const best = Math.max(...months.map((m) => m.value));

  return (
    <div className="space-y-6">
      <RoomHeader
        eyebrow="Revenue"
        title="What Gymix earns"
        description={`One plan, ${formatPrice(pricing.priceUsd)} a month. Payments are confirmed by hand in Clients or on a gym's card.`}
        action={<RangeSwitch base="/admin/revenue" days={days} />}
      />

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Monthly recurring" value={b.mrr} format="usd" hint={`${b.paying} paying × ${formatPrice(pricing.priceUsd)}`} />
        <Stat label="Yearly run rate" value={b.mrr * 12} format="usd" hint="if nothing changes" />
        <Stat label={`Collected, ${days} days`} value={collected} format="usd" hint={`${inRange.length} payments`} />
        <Stat label="Collected, all time" value={lifetime} format="usd" hint={`${all.length} payments`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel title="Collected per month · 12 months">
          <Columns values={months.map((m) => m.value)} labels={months.map((m) => m.label)} height={180} unit="USD" />
          <div className="mt-2 flex justify-between text-[10px] text-white/35">
            <span>{months[0].label}</span>
            <span>{best > 0 ? `Best month ${usd(best)}` : "No payments yet"}</span>
            <span>{months[11].label}</span>
          </div>
        </Panel>

        <Panel title="The gyms" pad={false}>
          <ul className="room-rows grid grid-cols-2 gap-2 p-5 pt-4">
            <Mix icon={CircleCheck} tone="text-emerald-300" label="Paying" n={b.paying} total={rows.length} />
            <Mix icon={Clock3} tone="text-sky-300" label="Free trial" n={b.trial} total={rows.length} />
            <Mix icon={CircleAlert} tone="text-amber-300" label="Due or ended" n={b.attention} total={rows.length} />
            <Mix icon={PauseCircle} tone="text-rose-300" label="Suspended" n={rows.filter((g) => g.sub === "suspended").length} total={rows.length} />
          </ul>
        </Panel>
      </div>

      <Panel title={`Follow up · ${follow.length}`} pad={false}>
        {!follow.length ? (
          <Empty>Every gym is paid up, and no trial ends in the next 3 days.</Empty>
        ) : (
          <ul className={`${tbody} mt-3 border-t border-white/[0.05]`}>
            {follow.map((g) => (
              <li key={g.gym_id}>
                <Link href={`/admin/gyms?gym=${g.gym_id}`} className={`group flex items-center gap-4 px-5 py-3 ${row}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="block truncate text-xs text-white/45">
                      {g.owner_name || g.owner_email}
                      {g.owner_phone ? ` · ${g.owner_phone}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <Pill tone={g.sub === "trial" ? "info" : g.sub === "grace" ? "warn" : "bad"}>
                      {g.sub === "trial" ? "Trial ending" : g.sub === "grace" ? "Payment due" : g.sub === "suspended" ? "Suspended" : "Ended"}
                    </Pill>
                    <span className="mt-1 block text-xs text-white/40">
                      {g.sub === "trial" ? `ends ${formatDate(g.trial_ends_at)}` : g.sub === "suspended" ? "staff locked out" : `since ${formatDate(g.paid_until ?? g.trial_ends_at)}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="room-ink grid gap-4 xl:grid-cols-2">
        <Panel title="Price">
          <p className="-mt-1 mb-4 text-sm text-white/45">Shows straight away on the landing page and every owner&apos;s Subscription tab. Running trials keep their end date.</p>
          <PricingForm priceUsd={pricing.priceUsd} trialDays={pricing.trialDays} graceDays={pricing.graceDays} />
        </Panel>
        <Panel title="Payment details">
          <p className="-mt-1 mb-4 text-sm text-white/45">Goes into the WhatsApp message with payment details sent from Clients.</p>
          <PlatformSettingsForm instructions={settings.instructions} whatsapp={settings.whatsapp} />
        </Panel>
      </div>

      <Panel title="Payment history" pad={false}>
        {!all.length ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="mt-3 max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Gym</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Months</th>
                  <th className={th}>Method</th>
                  <th className={th}>Paid until</th>
                  <th className={th}>By</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {all.map((x) => (
                  <tr key={x.id} className={row}>
                    <td className={`${td} whitespace-nowrap text-white/50`}>{formatDate(x.created_at)}</td>
                    <td className={td}>
                      <p className="font-medium">{x.gym_name}</p>
                      {x.note && <p className="text-xs text-white/40">{x.note}</p>}
                    </td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{usd(Number(x.amount_usd))}</td>
                    <td className={`${td} tabular-nums`}>{x.months}</td>
                    <td className={td}>{x.method}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(x.paid_until)}</td>
                    <td className={`${td} text-white/50`}>{x.recorded_by_name || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Mix({ icon: Icon, tone, label, n, total }: { icon: typeof CircleCheck; tone: string; label: string; n: number; total: number }) {
  return (
    <li className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-1.5 text-xs text-white/50">
        <Icon className={`size-3.5 ${tone}`} /> {label}
      </p>
      <p className="mt-1 text-2xl font-black tabular-nums">{n}</p>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="room-bar-fill block h-full rounded-full bg-brand/70" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
      </span>
    </li>
  );
}
