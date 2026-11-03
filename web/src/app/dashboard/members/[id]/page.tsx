import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import {
  INVOICE_STATUS,
  MEMBER_STATUS,
  PAYMENT_METHOD_LABELS,
  addDays,
  daysBetween,
  formatDate,
  formatDateTime,
  formatLBP,
  formatUSD,
  todayIn,
  type InvoiceStatus,
  type MemberStatus,
} from "@/lib/format";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  changeMembership,
  inviteToPortal,
  recordPayment,
  removePortalAccess,
  sellMembership,
  updateMember,
  voidInvoice,
} from "../actions";
import { ActionButton } from "../action-button";
import { CheckInButton } from "../check-in-button";
import { MemberForm } from "../member-form";
import { PaymentForm } from "../payment-form";
import { SellForm } from "../sell-form";

export const metadata: Metadata = { title: "Member" };

export default function MemberPage({ params }: PageProps<"/dashboard/members/[id]">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/dashboard/members" className="text-sm text-muted hover:text-ink">
        ← Members
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <MemberContent params={params} />
      </Suspense>
    </div>
  );
}

async function MemberContent({ params }: { params: PageProps<"/dashboard/members/[id]">["params"] }) {
  const { id } = await params;
  const { membership: staff } = await requireStaff();
  const canBill = BILLING_ROLES.includes(staff.role);
  const canManage = MANAGER_ROLES.includes(staff.role);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("member_overview")
    .select("*")
    .eq("id", id)
    .eq("gym_id", staff.gymId)
    .maybeSingle();
  if (!member) notFound();

  const today = todayIn(staff.timezone);
  const [memberships, invoices, payments, checkins, plans, invite] = await Promise.all([
    supabase.from("memberships").select("*").eq("member_id", id).order("starts_on", { ascending: false }).limit(20),
    canBill
      ? supabase.from("invoice_summary").select("*").eq("member_id", id).order("number", { ascending: false })
      : null,
    canBill
      ? supabase.from("payments").select("*").eq("member_id", id).order("paid_at", { ascending: false }).limit(20)
      : null,
    supabase.from("checkins").select("*").eq("member_id", id).order("checked_in_at", { ascending: false }).limit(10),
    canBill
      ? supabase.from("membership_plans").select("*").eq("gym_id", staff.gymId).eq("is_active", true).order("price_usd")
      : null,
    member.email && !member.user_id
      ? supabase.from("invites").select("id").eq("gym_id", staff.gymId).eq("email", member.email).is("accepted_at", null).maybeSingle()
      : null,
  ]);

  const status = MEMBER_STATUS[(member.status ?? "none") as MemberStatus];
  const currentId = member.membership_id;
  const current = memberships.data?.find((m) => m.id === currentId) ?? null;
  // Renewing an active membership starts the day after it ends.
  const defaultStart = current && current.ends_on && current.ends_on >= today && !current.frozen_on ? addDays(current.ends_on, 1) : today;
  const daysLeft = current && member.status === "active" ? daysBetween(today, current.ends_on) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{member.full_name}</h1>
              <Badge tone={status.tone}>{status.label}</Badge>
              {canBill && Number(member.balance_usd) > 0 && <Badge tone="red">Owes {formatUSD(member.balance_usd)}</Badge>}
            </div>
            <p className="text-sm text-muted">
              {[member.phone, member.email].filter(Boolean).join(" · ") || "No contact details"}
            </p>
            {member.notes && <p className="text-sm">📝 {member.notes}</p>}
            <p className="text-xs text-muted">
              Check-in code <span className="font-mono font-medium text-ink">{member.checkin_code}</span> ·{" "}
              {member.user_id ? "Has portal access" : invite?.data ? "Portal invite pending" : "No portal account"}
            </p>
          </div>
          {canBill && <CheckInButton memberId={member.id!} />}
        </div>
      </Card>

      {/* Current membership */}
      <Card>
        <SectionTitle>Current membership</SectionTitle>
        {!current ? (
          <EmptyState>No membership yet.{canBill && " Sell one below."}</EmptyState>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
            <div>
              <p className="font-medium">{current.plan_name}</p>
              <p className="text-sm text-muted">
                {formatDate(current.starts_on)} → {formatDate(current.ends_on)}
                {daysLeft !== null && ` · ${daysLeft === 0 ? "last day today" : `${daysLeft} days left`}`}
                {current.visit_limit && ` · ${current.visit_limit - current.visits_used} of ${current.visit_limit} visits left`}
                {current.frozen_on && ` · frozen since ${formatDate(current.frozen_on)}`}
              </p>
            </div>
            {canBill && member.status !== "expired" && (
              <div className="flex flex-wrap gap-2">
                {current.frozen_on ? (
                  <ActionButton action={changeMembership.bind(null, current.id, "unfreeze")} label="Unfreeze" />
                ) : (
                  <ActionButton
                    action={changeMembership.bind(null, current.id, "freeze")}
                    label="Freeze"
                    confirm="Freeze this membership? The days it stays frozen are added back when you unfreeze."
                  />
                )}
                {canManage && (
                  <ActionButton
                    action={changeMembership.bind(null, current.id, "cancel")}
                    label="Cancel"
                    variant="danger"
                    confirm="Cancel this membership? This can't be undone. Invoices stay as they are."
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {canBill && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">{current ? "Renew or sell another membership" : "Sell a membership"}</h2>
          <SellForm
            // Remount after a sale so the start date moves to the new renewal date.
            key={`${currentId}-${current?.ends_on}`}
            action={sellMembership.bind(null, member.id!)}
            plans={(plans?.data ?? []).map((p) => ({ ...p, price_usd: Number(p.price_usd) }))}
            defaultStart={defaultStart}
            rate={staff.lbpRate}
          />
        </Card>
      )}

      {canBill && (
        <Card>
          <SectionTitle>Invoices</SectionTitle>
          {!invoices?.data?.length ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {invoices.data.map((inv) => {
                const s = INVOICE_STATUS[inv.status as InvoiceStatus];
                const balance = Number(inv.balance_usd);
                const hasPayments = Number(inv.paid_usd) > 0;
                return (
                  <li key={inv.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-mono text-xs text-muted">#{String(inv.number).padStart(4, "0")}</span>
                      <span className="min-w-0 flex-1 text-sm">{inv.description}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="w-40 text-right text-sm tabular-nums">
                        {formatUSD(inv.total_usd)}
                        {Number(inv.discount_usd) > 0 && (
                          <span className="block text-xs text-muted">after {formatUSD(inv.discount_usd)} discount</span>
                        )}
                        {balance > 0 && inv.status !== "void" && (
                          <span className="block text-xs text-danger">{formatUSD(balance)} due</span>
                        )}
                      </span>
                    </div>
                    {inv.status !== "void" && (balance > 0 || (canManage && !hasPayments)) && (
                      <div className="mt-2 flex flex-wrap items-start gap-3">
                        {balance > 0 && (
                          <details className="min-w-0 flex-1 rounded-lg border border-line">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Record a payment</summary>
                            <div className="border-t border-line p-3">
                              <PaymentForm action={recordPayment.bind(null, inv.id!)} balance={balance} rate={staff.lbpRate} />
                            </div>
                          </details>
                        )}
                        {canManage && !hasPayments && (
                          <ActionButton
                            action={voidInvoice.bind(null, inv.id!)}
                            label="Void"
                            variant="ghost"
                            confirm="Void this invoice? Its membership will be cancelled too."
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {canBill && (
          <Card>
            <SectionTitle>Payments</SectionTitle>
            {!payments?.data?.length ? (
              <EmptyState>No payments yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {payments.data.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>
                      {PAYMENT_METHOD_LABELS[p.method]}
                      <span className="block text-xs text-muted">
                        {formatDateTime(p.paid_at, staff.timezone)}
                        {p.amount_lbp ? ` · ${formatLBP(p.amount_lbp)}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">{formatUSD(p.amount_usd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <SectionTitle>Recent visits</SectionTitle>
          {!checkins.data?.length ? (
            <EmptyState>No visits yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {checkins.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>{formatDateTime(c.checked_in_at, staff.timezone)}</span>
                  {c.allowed ? <Badge tone="green">Checked in</Badge> : <Badge tone="red">{c.reason ?? "Denied"}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {memberships.data && memberships.data.length > 1 && (
        <Card>
          <SectionTitle>Membership history</SectionTitle>
          <ul className="divide-y divide-line border-t border-line">
            {memberships.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span>
                  {m.plan_name}
                  <span className="block text-xs text-muted">
                    {formatDate(m.starts_on)} → {formatDate(m.ends_on)}
                  </span>
                </span>
                {m.cancelled_at ? (
                  <Badge tone="gray">Cancelled</Badge>
                ) : m.ends_on < today ? (
                  <Badge tone="gray">Ended</Badge>
                ) : m.starts_on > today ? (
                  <Badge tone="amber">Upcoming</Badge>
                ) : (
                  <Badge tone="green">Current</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canBill && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Details & portal access</h2>
          <MemberForm
            action={updateMember.bind(null, member.id!)}
            initial={{ full_name: member.full_name!, phone: member.phone, email: member.email, notes: member.notes }}
            submitLabel="Save details"
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
            {member.user_id ? (
              <>
                <span className="text-muted">They can log in to the member portal.</span>
                <ActionButton
                  action={async () => {
                    "use server";
                    await removePortalAccess(member.id!);
                    return { success: "Portal access removed." };
                  }}
                  label="Remove portal access"
                  variant="ghost"
                  confirm="Remove their portal access? Their membership and history stay."
                />
              </>
            ) : (
              <>
                <span className="text-muted">
                  {invite?.data
                    ? `Invite pending for ${member.email}.`
                    : member.email
                      ? "Not on the portal yet."
                      : "Add an email to invite them to the portal."}
                </span>
                {member.email && !invite?.data && (
                  <ActionButton action={inviteToPortal.bind(null, member.id!)} label="Invite to portal" />
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
