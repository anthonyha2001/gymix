import type { Metadata } from "next";
import { Suspense } from "react";
import { Nfc } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import {
  INVOICE_STATUS,
  MEMBER_STATUS,
  daysBetween,
  formatDate,
  formatDateTime,
  formatUSD,
  todayIn,
  type InvoiceStatus,
  type MemberStatus,
} from "@/lib/format";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My gym" };

// Each tile becomes a real section as its phase ships.
const COMING = [
  { title: "My program", body: "Your trainer's program, with a how-to GIF for every machine." },
  { title: "Workout log", body: "Log sets, reps and weight — and beat last time." },
  { title: "Schedule", body: "Classes and PT sessions you've booked." },
  { title: "Progress", body: "Body measurements, personal records and charts." },
];

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <PortalContent />
      </Suspense>
      <div className="grid gap-3 sm:grid-cols-2">
        {COMING.map((s) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{s.title}</h2>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">Soon</span>
            </div>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function PortalContent() {
  const { viewer, membership } = await requireMember();
  const tz = membership.timezone;
  const today = todayIn(tz);
  const firstName = viewer.fullName.split(" ")[0];
  const supabase = await createClient();

  const { data: me } = await supabase
    .from("member_overview")
    .select("*")
    .eq("gym_id", membership.gymId)
    .eq("user_id", viewer.id)
    .maybeSingle();

  const [invoices, visits] = me
    ? await Promise.all([
        supabase.from("invoice_summary").select("*").eq("member_id", me.id!).neq("status", "void").order("number", { ascending: false }).limit(12),
        supabase.from("checkins").select("id, allowed, reason, checked_in_at").eq("member_id", me.id!).order("checked_in_at", { ascending: false }).limit(5),
      ])
    : [null, null];

  const status = MEMBER_STATUS[(me?.status ?? "none") as MemberStatus];
  const daysLeft = me?.status === "active" && me.ends_on ? daysBetween(today, me.ends_on) : null;
  const balance = Number(me?.balance_usd ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{membership.gymName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hi{firstName ? `, ${firstName}` : ""} 👋</h1>
      </div>

      <Card className="overflow-hidden">
        <div className={`p-5 ${me?.status === "active" ? "bg-ink text-white" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm ${me?.status === "active" ? "text-white/70" : "text-muted"}`}>Membership</p>
              <p className="text-xl font-semibold">{me?.plan_name ?? "No membership yet"}</p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {me?.ends_on && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className={`text-xs ${me.status === "active" ? "text-white/70" : "text-muted"}`}>
                  {me.status === "expired" ? "Ended" : "Valid until"}
                </p>
                <p className="font-medium">{formatDate(me.ends_on)}</p>
              </div>
              {daysLeft !== null && (
                <div>
                  <p className="text-xs text-white/70">Days left</p>
                  <p className="text-brand text-2xl font-bold leading-none tabular-nums">{daysLeft}</p>
                </div>
              )}
              {me.visit_limit && (
                <div>
                  <p className={`text-xs ${me.status === "active" ? "text-white/70" : "text-muted"}`}>Visits left</p>
                  <p className="font-medium">
                    {Math.max(me.visit_limit - (me.visits_used ?? 0), 0)} of {me.visit_limit}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {balance > 0 && (
          <p className="border-t border-line bg-danger-soft px-5 py-3 text-sm font-medium text-danger">
            You have {formatUSD(balance)} to pay at the front desk.
          </p>
        )}
        {(!me || me.status === "expired" || me.status === "none") && (
          <p className="border-t border-line px-5 py-3 text-sm text-muted">Renew at the front desk to keep training.</p>
        )}
      </Card>

      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand">
          <Nfc className="size-6" />
        </span>
        <div>
          <p className="font-semibold">Checking in</p>
          <p className="text-sm text-muted">
            Tap your phone on the Gymix sticker at the entrance. You&apos;ll see a green screen when you&apos;re in.
          </p>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle>Invoices</SectionTitle>
          {!invoices?.data?.length ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {invoices.data.map((inv) => {
                const s = INVOICE_STATUS[inv.status as InvoiceStatus];
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{inv.description}</span>
                      <span className="block text-xs text-muted">
                        #{String(inv.number).padStart(4, "0")} · {formatDate(inv.issued_on)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-medium tabular-nums">{formatUSD(inv.total_usd)}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle>Recent visits</SectionTitle>
          {!visits?.data?.length ? (
            <EmptyState>No visits yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {visits.data.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>{formatDateTime(v.checked_in_at, tz)}</span>
                  {v.allowed ? <Badge tone="green">Checked in</Badge> : <Badge tone="red">{v.reason ?? "Denied"}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
