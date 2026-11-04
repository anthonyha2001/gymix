import type { Metadata } from "next";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import {
  INVOICE_STATUS,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatDateTime,
  formatLBP,
  formatUSD,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/lib/format";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { RowMenu } from "@/components/row-menu";
import { refundPayment, voidInvoice } from "../members/actions";
import { RefundForm } from "../members/admin-forms";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Billing" };

const TABS = [
  { value: "owing", label: "Owing" },
  { value: "all", label: "All invoices" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "payments", label: "Payments" },
];

export default function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Billing" description="Invoices are created when you sell a membership. All amounts in USD." />
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BillingContent({ searchParams }: { searchParams: PageProps<"/dashboard/billing">["searchParams"] }) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const canManage = MANAGER_ROLES.includes(membership.role);
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.value === rawTab) ? (rawTab as string) : "owing";
  const tz = membership.timezone;
  const supabase = await createClient();

  let invoiceQuery = supabase
    .from("invoice_summary")
    .select("id, number, member_id, description, total_usd, paid_usd, balance_usd, status, issued_on")
    .eq("gym_id", membership.gymId)
    .order("number", { ascending: false })
    .limit(200);
  if (tab === "owing") invoiceQuery = invoiceQuery.in("status", ["unpaid", "partial"]);
  if (tab === "paid") invoiceQuery = invoiceQuery.eq("status", "paid");
  if (tab === "void") invoiceQuery = invoiceQuery.eq("status", "void");

  const [{ data: stats }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.rpc("gym_stats", { p_gym_id: membership.gymId }).single(),
    invoiceQuery,
    supabase
      .from("payments")
      .select("id, member_id, amount_usd, method, amount_lbp, paid_at, note")
      .eq("gym_id", membership.gymId)
      .order("paid_at", { ascending: false })
      .limit(300),
  ]);

  const memberIds = [...new Set([...(invoices ?? []).map((i) => i.member_id!), ...(payments ?? []).map((p) => p.member_id)])];
  const { data: members } = memberIds.length
    ? await supabase.from("members").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  // This month's takings by payment method (for counting the till).
  const monthKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date(iso));
  const thisMonth = monthKey(new Date().toISOString());
  const byMethod = new Map<PaymentMethod, { usd: number; lbp: number; count: number }>();
  for (const p of payments ?? []) {
    if (monthKey(p.paid_at) !== thisMonth) continue;
    const row = byMethod.get(p.method) ?? { usd: 0, lbp: 0, count: 0 };
    row.usd += Number(p.amount_usd);
    row.lbp += Number(p.amount_lbp ?? 0);
    row.count += 1;
    byMethod.set(p.method, row);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted">Collected this month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatUSD(stats?.collected_month)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Owed by members</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${Number(stats?.outstanding) > 0 ? "text-danger" : ""}`}>
            {formatUSD(stats?.outstanding)}
          </p>
        </Card>
      </div>

      {byMethod.size > 0 && (
        <Card>
          <SectionTitle>This month by payment method</SectionTitle>
          <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[...byMethod.entries()].map(([method, row]) => (
              <li key={method} className="bg-surface px-5 py-3">
                <p className="text-xs text-muted">
                  {PAYMENT_METHOD_LABELS[method]} · {row.count} payment{row.count === 1 ? "" : "s"}
                </p>
                <p className="font-semibold tabular-nums">{formatUSD(row.usd)}</p>
                {row.lbp > 0 && <p className="text-xs text-muted">{formatLBP(row.lbp)} received</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <HoverLink
            key={t.value}
            href={`/dashboard/billing?tab=${t.value}`}
              scroll={false}
            className={`rounded-full border px-3 py-1 text-sm ${
              tab === t.value ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </HoverLink>
        ))}
      </div>
      {tab !== "payments" && (
      <Card className="overflow-hidden">
        {!invoices?.length ? (
          <EmptyState>{tab === "owing" ? "Nobody owes anything." : "No invoices here yet."}</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">For</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Due</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((inv) => {
                  const s = INVOICE_STATUS[inv.status as InvoiceStatus];
                  return (
                    <tr key={inv.id} className="hover:bg-canvas/50">
                      <td className="px-5 py-3 font-mono text-xs text-muted">{String(inv.number).padStart(4, "0")}</td>
                      <td className="px-5 py-3">
                        <HoverLink href={`/dashboard/members/${inv.member_id}`} className="font-medium hover:underline">
                          {nameOf.get(inv.member_id!) ?? "Member"}
                        </HoverLink>
                        <p className="text-xs text-muted">{formatDate(inv.issued_on)}</p>
                      </td>
                      <td className="hidden max-w-xs truncate px-5 py-3 text-muted md:table-cell">{inv.description}</td>
                      <td className="px-5 py-3">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatUSD(inv.total_usd)}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${Number(inv.balance_usd) > 0 && inv.status !== "void" ? "font-medium text-danger" : "text-muted"}`}>
                        {Number(inv.balance_usd) > 0 && inv.status !== "void" ? formatUSD(inv.balance_usd) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <RowMenu
                          label={`Actions for invoice ${inv.number}`}
                          items={[
                            { kind: "link", label: "Open member", href: `/dashboard/members/${inv.member_id}` },
                            canManage &&
                              inv.status !== "void" &&
                              Number(inv.paid_usd) === 0 && {
                                kind: "action",
                                label: "Void invoice",
                                danger: true,
                                action: voidInvoice.bind(null, inv.id!),
                                confirm: "Void this invoice? Its membership will be cancelled too.",
                              },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}

      {tab === "payments" && (
      <Card>
        <SectionTitle>Latest payments</SectionTitle>
        {!payments?.length ? (
          <EmptyState>No payments yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {payments.slice(0, 15).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <HoverLink href={`/dashboard/members/${p.member_id}`} className="font-medium hover:underline">
                    {nameOf.get(p.member_id) ?? "Member"}
                  </HoverLink>
                  <span className="block text-xs text-muted">
                    {PAYMENT_METHOD_LABELS[p.method]} · {formatDateTime(p.paid_at, tz)}
                    {p.amount_lbp ? ` · ${formatLBP(p.amount_lbp)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium tabular-nums">{formatUSD(p.amount_usd)}</span>
                  {canManage && (
                    <RowMenu
                      label="Payment actions"
                      items={[
                        {
                          kind: "dialog",
                          label: "Refund",
                          danger: true,
                          title: "Refund payment",
                          content: <RefundForm action={refundPayment.bind(null, p.id)} amountUsd={Number(p.amount_usd)} />,
                        },
                      ]}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      )}
    </div>
  );
}
