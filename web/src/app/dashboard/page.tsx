import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { addDays, daysBetween, formatDate, formatTime, formatUSD, todayIn } from "@/lib/format";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Overview" description="Your gym today." />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
      >
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const { membership } = await requireStaff();
  const canBill = BILLING_ROLES.includes(membership.role);
  const tz = membership.timezone;
  const today = todayIn(tz);
  const supabase = await createClient();

  const [{ data: stats }, { data: expiring }, { data: recent }, { count: planCount }, { count: memberCount }] =
    await Promise.all([
      supabase.rpc("gym_stats", { p_gym_id: membership.gymId }).single(),
      supabase
        .from("member_overview")
        .select("id, full_name, phone, plan_name, ends_on")
        .eq("gym_id", membership.gymId)
        .eq("status", "active")
        .gte("ends_on", today)
        .lte("ends_on", addDays(today, 7))
        .order("ends_on")
        .limit(10),
      supabase
        .from("checkins")
        .select("id, allowed, checked_in_at, member_id, members(full_name)")
        .eq("gym_id", membership.gymId)
        .order("checked_in_at", { ascending: false })
        .limit(8),
      supabase.from("membership_plans").select("id", { count: "exact", head: true }).eq("gym_id", membership.gymId),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", membership.gymId),
    ]);

  const tiles = [
    { label: "Active members", value: String(stats?.active_members ?? 0), href: "/dashboard/members?status=active" },
    { label: "Check-ins today", value: String(stats?.checkins_today ?? 0), href: canBill ? "/dashboard/check-in" : undefined },
    { label: "Expiring in 7 days", value: String(stats?.expiring_soon ?? 0) },
    ...(canBill
      ? [
          { label: "Collected this month", value: formatUSD(stats?.collected_month), href: "/dashboard/billing?tab=all" },
          { label: "Owed by members", value: formatUSD(stats?.outstanding), href: "/dashboard/billing", alert: Number(stats?.outstanding) > 0 },
        ]
      : []),
  ];

  const setup = [
    { done: (planCount ?? 0) > 0, label: "Create your membership plans", href: "/dashboard/plans", show: membership.role === "owner" || membership.role === "manager" },
    { done: (memberCount ?? 0) > 0, label: "Add your first member and sell a membership", href: "/dashboard/members/new", show: canBill },
    { done: (stats?.checkins_today ?? 0) > 0 || (recent?.length ?? 0) > 0, label: "Set up the tap-to-check-in sticker", href: "/dashboard/settings", show: membership.role === "owner" },
  ].filter((s) => s.show);
  const setupDone = setup.every((s) => s.done);

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 sm:grid-cols-2 ${canBill ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
        {tiles.map((t) => {
          const body = (
            <Card className={`h-full p-5 ${t.href ? "transition-colors hover:border-ink/30" : ""}`}>
              <p className="text-sm text-muted">{t.label}</p>
              <p className={`mt-2 text-3xl font-semibold tabular-nums ${"alert" in t && t.alert ? "text-danger" : ""}`}>{t.value}</p>
            </Card>
          );
          return t.href ? (
            <Link key={t.label} href={t.href}>
              {body}
            </Link>
          ) : (
            <div key={t.label}>{body}</div>
          );
        })}
      </div>

      {!setupDone && setup.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Get set up</h2>
          <ul className="mt-3 space-y-2">
            {setup.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                {s.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted" />}
                {s.done ? (
                  <span className="text-muted line-through">{s.label}</span>
                ) : (
                  <Link href={s.href} className="font-medium underline underline-offset-4">
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Memberships ending this week</SectionTitle>
          {!expiring?.length ? (
            <EmptyState>None in the next 7 days.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {expiring.map((m) => {
                const left = daysBetween(today, m.ends_on!);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link href={`/dashboard/members/${m.id}`} className="font-medium hover:underline">
                        {m.full_name}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {m.plan_name} · ends {formatDate(m.ends_on)}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </span>
                    </span>
                    <Badge tone={left <= 2 ? "red" : "amber"}>{left === 0 ? "Today" : left === 1 ? "Tomorrow" : `${left} days`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Latest check-ins</SectionTitle>
          {!recent?.length ? (
            <EmptyState>No check-ins yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-muted">{formatTime(c.checked_in_at, tz)}</span>
                  <Link href={`/dashboard/members/${c.member_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {c.members?.full_name ?? "Member"}
                  </Link>
                  {c.allowed ? <Badge tone="green">In</Badge> : <Badge tone="red">Denied</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
