import { Nfc } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
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
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// The member portal's home screen for one member. Used by the real portal and
// by staff's read-only "View as member" preview, so both always match.
export async function MemberHome({
  supabase,
  memberId,
  gymName,
  timeZone,
}: {
  supabase: Client;
  memberId: string;
  gymName: string;
  timeZone: string;
}) {
  const today = todayIn(timeZone);
  const [{ data: me }, { data: invoices }, { data: visits }] = await Promise.all([
    supabase.from("member_overview").select("*").eq("id", memberId).maybeSingle(),
    supabase.from("invoice_summary").select("*").eq("member_id", memberId).neq("status", "void").order("number", { ascending: false }).limit(12),
    supabase.from("checkins").select("id, allowed, reason, checked_in_at").eq("member_id", memberId).order("checked_in_at", { ascending: false }).limit(5),
  ]);

  const firstName = me?.full_name?.split(" ")[0];
  const status = MEMBER_STATUS[(me?.status ?? "none") as MemberStatus];
  const daysLeft = me?.status === "active" && me.ends_on ? daysBetween(today, me.ends_on) : null;
  const balance = Number(me?.balance_usd ?? 0);
  const active = me?.status === "active";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{gymName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back{firstName ? `, ${firstName}` : ""}</h1>
      </div>

      <Card className="overflow-hidden">
        <div className={`p-5 ${active ? "bg-ink text-white" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm ${active ? "text-white/70" : "text-muted"}`}>Membership</p>
              <p className="text-xl font-semibold">{me?.plan_name ?? "No membership yet"}</p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {me?.ends_on && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className={`text-xs ${active ? "text-white/70" : "text-muted"}`}>{me.status === "expired" ? "Ended" : "Valid until"}</p>
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
                  <p className={`text-xs ${active ? "text-white/70" : "text-muted"}`}>Visits left</p>
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
          {!invoices?.length ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {invoices.map((inv) => {
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
          {!visits?.length ? (
            <EmptyState>No visits yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {visits.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>{formatDateTime(v.checked_in_at, timeZone)}</span>
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
