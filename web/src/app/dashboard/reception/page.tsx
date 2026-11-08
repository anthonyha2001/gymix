import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ExternalLink, Plus, Tablet } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton, buttonClass } from "@/components/ui";
import { formatDateTime, formatUSD } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { requestOrigin } from "@/lib/origin";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CopyField } from "../access/forms";
import { ago, isRecent } from "../access/shared";
import { cancelPayment, confirmPayment, createKiosk, deleteKiosk, savePaymentOptions, setKioskActive, updateKiosk } from "./actions";
import { ConfirmForm, KioskForm, PaymentOptionsForm } from "./forms";

export const metadata: Metadata = { title: "Reception" };

const TABS = ["waiting", "kiosks", "payments"] as const;
const CHANNEL = { desk: "At the desk", card_terminal: "Card at the desk", whish: "Whish", omt: "OMT", online: "Online" } as const;

export default function ReceptionPage({ searchParams }: PageProps<"/dashboard/reception">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <ReceptionContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ReceptionContent({ searchParams }: { searchParams: PageProps<"/dashboard/reception">["searchParams"] }) {
  const { membership } = await requireStaff(BILLING_ROLES);
  if (!(await hasFeature(membership.gymId, "self_service"))) redirect("/dashboard");
  const manager = MANAGER_ROLES.includes(membership.role);
  const tabs = TABS.filter((t) => manager || t === "waiting");
  const tab = activeTab((await searchParams).tab, tabs);
  const supabase = await createClient();
  const { data: intents } = await supabase
    .from("payment_intents")
    .select("id, reference, amount_usd, channel, status, created_at, paid_at, expires_at, members(id, full_name, phone), membership_plans(name), kiosks(name)")
    .eq("gym_id", membership.gymId)
    .order("created_at", { ascending: false })
    .limit(40);
  const now = new Date().toISOString();
  const waiting = (intents ?? []).filter((i) => i.status === "pending" && i.expires_at > now);
  const done = (intents ?? []).filter((i) => !(i.status === "pending" && i.expires_at > now)).slice(0, 15);

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title="Reception" description="Payments started at the self-service kiosk. Confirm one and the membership switches on." />
      <PageTabs instant base="/dashboard/reception" active={tab} tabs={tabs.map((t) => ({ id: t, label: { waiting: "Waiting payments", kiosks: "Kiosks", payments: "Ways to pay" }[t], count: t === "waiting" && waiting.length ? waiting.length : undefined }))} />

      <TabPanel id="waiting" tabs={tabs}>
        <div className="space-y-4">
          <Card>
            <SectionTitle>Waiting for payment</SectionTitle>
            {!waiting.length ? (
              <EmptyState>Nothing waiting. When someone buys at the kiosk, they appear here with their code.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {waiting.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="rounded-xl bg-brand px-3 py-2 font-mono text-lg font-bold tracking-wider">{i.reference}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <Link href={`/dashboard/members/${i.members?.id}`} className="block font-semibold hover:underline">
                        {i.members?.full_name}
                      </Link>
                      <span className="block text-muted">
                        {i.membership_plans?.name} · {CHANNEL[i.channel as keyof typeof CHANNEL]} · {formatDateTime(i.created_at, membership.timezone)}
                      </span>
                    </span>
                    <span className="text-xl font-semibold tabular-nums">{formatUSD(i.amount_usd)}</span>
                    <span className="flex items-center gap-2">
                      <Dialog label="Confirm paid" title={`${i.reference} · ${i.members?.full_name}`} triggerClassName="h-9">
                        <ConfirmForm action={confirmPayment.bind(null, i.id)} amount={Number(i.amount_usd)} channel={i.channel} lbpRate={membership.lbpRate} />
                      </Dialog>
                      <RowMenu label={`Actions for ${i.reference}`} items={[{ kind: "action", label: "Cancel", danger: true, action: cancelPayment.bind(null, i.id), confirm: `Cancel ${i.reference}? The kiosk tells them to ask at the desk.` }]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {done.length > 0 && (
            <Card>
              <SectionTitle>Recent</SectionTitle>
              <ul className="divide-y divide-line border-t border-line">
                {done.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-20 font-mono text-xs text-muted">{i.reference}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{i.members?.full_name}</span>
                      <span className="text-muted"> · {i.membership_plans?.name}</span>
                    </span>
                    <span className="tabular-nums">{formatUSD(i.amount_usd)}</span>
                    {i.status === "paid" ? <Badge tone="green">Paid</Badge> : i.status === "cancelled" ? <Badge tone="gray">Cancelled</Badge> : <Badge tone="gray">Expired</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </TabPanel>

      {manager && (
        <>
          <TabPanel id="kiosks" tabs={tabs}>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <KiosksPanel gymId={membership.gymId} />
            </Suspense>
          </TabPanel>
          <TabPanel id="payments" tabs={tabs}>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <PaymentsPanel gymId={membership.gymId} />
            </Suspense>
          </TabPanel>
        </>
      )}
    </>
  );
}

async function KiosksPanel({ gymId }: { gymId: string }) {
  const supabase = await createClient();
  const { data: kiosks } = await supabase.from("kiosks").select("*").eq("gym_id", gymId).order("created_at");
  const origin = await requestOrigin();
  return (
    <Card>
      <SectionTitle
        action={
          <Dialog label="Add kiosk" icon={<Plus className="size-4" />} variant="secondary" triggerClassName="h-9" title="Add a kiosk" description="A tablet at the entrance.">
            <KioskForm action={createKiosk} submitLabel="Add kiosk" />
          </Dialog>
        }
      >
        Kiosks
      </SectionTitle>
      {!kiosks?.length ? (
        <EmptyState>Add a kiosk, then open its link full screen on a tablet at the entrance (iPad or Android, in kiosk or guided-access mode).</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {kiosks.map((k) => {
            const url = `${origin}/kiosk/${k.token}`;
            const can = [k.allow_checkin && "check in", k.allow_buy && "buy", k.allow_join && "join"].filter(Boolean).join(", ");
            return (
              <li key={k.id} className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-ink text-brand">
                      <Tablet className="size-5" />
                    </span>
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        {k.name}
                        <Badge tone={!k.is_active ? "gray" : isRecent(k.last_seen_at, 15 * 60_000) ? "green" : "amber"}>{!k.is_active ? "Off" : isRecent(k.last_seen_at, 15 * 60_000) ? "In use" : "Not open"}</Badge>
                      </span>
                      <span className="text-xs text-muted">
                        People can {can || "do nothing yet"} · last used {ago(k.last_seen_at)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "h-9 px-3")} aria-label={`Open ${k.name}`} title="Open">
                      <ExternalLink className="size-4" />
                    </a>
                    <RowMenu
                      label={`Actions for ${k.name}`}
                      items={[
                        { kind: "dialog", label: "Edit", title: `Edit ${k.name}`, content: <KioskForm action={updateKiosk.bind(null, k.id)} initial={k} submitLabel="Save" /> },
                        { kind: "action", label: k.is_active ? "Switch off" : "Switch on", action: setKioskActive.bind(null, k.id, !k.is_active) },
                        { kind: "action", label: "Remove", danger: true, action: deleteKiosk.bind(null, k.id), confirm: `Remove ${k.name}? Its link stops working.` },
                      ]}
                    />
                  </span>
                </div>
                <CopyField label={`Link for ${k.name}`} value={url} secret />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

async function PaymentsPanel({ gymId }: { gymId: string }) {
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("kiosk_whish_number, kiosk_omt_name, kiosk_card_terminal").eq("id", gymId).single();
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="font-semibold">Ways to pay at the kiosk</h2>
        <p className="mb-4 text-sm text-muted">Paying at the desk is always offered. Add the others you accept.</p>
        <PaymentOptionsForm action={savePaymentOptions} whish={gym?.kiosk_whish_number ?? null} omt={gym?.kiosk_omt_name ?? null} terminal={gym?.kiosk_card_terminal ?? false} />
      </Card>
      <Card className="p-5 text-sm">
        <h2 className="font-semibold">Automatic confirmation</h2>
        <p className="mt-1 text-muted">
          A payment provider (a card gateway, or a Whish business account) can confirm payments for you, so memberships switch on without anyone at the desk. Gymix accepts signed confirmations with the kiosk code; ask Gymix support to connect your provider.
        </p>
      </Card>
    </div>
  );
}
