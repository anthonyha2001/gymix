import { todayIn } from "@/lib/format";
import { subscriptionStatus, type Pricing } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_TZ, EMPTY_TOTALS, type Monitoring } from "./widgets";

// Server-side reads shared by the control room screens (Revenue, Sign-ins,
// Settings). Each RPC checks the caller is a platform admin.

export async function monitoring(days: number): Promise<Monitoring> {
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

export async function recentEvents(kinds: string[], limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_events", { p_kinds: kinds, p_limit: limit });
  return data ?? [];
}

export async function gymRows(pricing: Pricing) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_gym_overview");
  const today = todayIn(ADMIN_TZ);
  return (data ?? []).map((g) => ({
    ...g,
    sub: subscriptionStatus(g.trial_ends_at, g.paid_until, today, pricing.graceDays, Boolean(g.suspended_at)),
  }));
}
export type GymRow = Awaited<ReturnType<typeof gymRows>>[number];

export function business(rows: GymRow[], pricing: Pricing) {
  const paying = rows.filter((g) => g.sub === "active").length;
  return {
    paying,
    trial: rows.filter((g) => g.sub === "trial").length,
    attention: rows.filter((g) => g.sub === "grace" || g.sub === "expired").length,
    mrr: paying * pricing.priceUsd,
    members: rows.reduce((n, g) => n + g.members, 0),
  };
}

export function addDaysIso(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const RANGES = [7, 30, 90] as const;
export const rangeOf = (v: string | string[] | undefined) => RANGES.find((r) => String(r) === v) ?? 30;
