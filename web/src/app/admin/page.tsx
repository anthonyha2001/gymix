import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, Logo, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { formatDate, formatUSD, todayIn } from "@/lib/format";
import { PRICE_USD, SUBSCRIPTION_STATUS, subscriptionStatus } from "@/lib/pricing";
import { platformSettings } from "@/lib/subscription";
import { extendTrial, recordSubscriptionPayment } from "./actions";
import { ExtendTrialForm, PlatformSettingsForm, RecordPaymentForm } from "./forms";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Platform admin" };

// Gymix's own console: every gym on the platform and how it's doing.
export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-3">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-ink">
              <ShieldCheck className="size-3.5" /> Super admin
            </span>
          </span>
          <form action={signOut}>
            <button className="rounded-lg px-3 h-9 text-sm text-white/70 hover:bg-white/10 hover:text-white">Log out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        <PageHeader
          title="Gyms on Gymix"
          description="Platform health at a glance. Member details stay private to each gym."
        />
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Overview />
        </Suspense>
      </main>
    </div>
  );
}

async function Overview() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [{ data: gyms }, settings] = await Promise.all([supabase.rpc("admin_gym_overview"), platformSettings()]);
  const today = todayIn("Asia/Beirut");
  const rows = (gyms ?? []).map((g) => ({ ...g, sub: subscriptionStatus(g.trial_ends_at, g.paid_until, today) }));
  const paying = rows.filter((g) => g.sub === "active").length;

  const totals = [
    { label: "Gyms", value: String(rows.length) },
    { label: "Paying gyms", value: String(paying) },
    { label: "On free trial", value: String(rows.filter((g) => g.sub === "trial").length) },
    { label: "Monthly revenue", value: formatUSD(paying * PRICE_USD) },
    { label: "Members", value: rows.reduce((n, g) => n + g.members, 0).toLocaleString() },
    { label: "Active memberships", value: rows.reduce((n, g) => n + g.active_members, 0).toLocaleString() },
    { label: "Check-ins (30 days)", value: rows.reduce((n, g) => n + g.checkins_30d, 0).toLocaleString() },
    { label: "Collected by gyms (30 days)", value: formatUSD(rows.reduce((n, g) => n + Number(g.collected_30d), 0)) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((t) => (
          <Card key={t.label} className="p-5">
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <SectionTitle>All gyms</SectionTitle>
        {!rows.length ? (
          <EmptyState>No gyms yet. They appear here as owners sign up.</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Gym</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Subscription</th>
                  <th className="px-5 py-3 text-right font-medium">Staff</th>
                  <th className="px-5 py-3 text-right font-medium">Members</th>
                  <th className="px-5 py-3 text-right font-medium">Active</th>
                  <th className="px-5 py-3 text-right font-medium">Check-ins 30d</th>
                  <th className="px-5 py-3 text-right font-medium">Collected 30d</th>
                  <th className="px-5 py-3 font-medium">Last check-in</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((g) => (
                  <tr key={g.gym_id} className="hover:bg-canvas/50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted">since {formatDate(g.created_at)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p>{g.owner_name || "—"}</p>
                      <p className="text-xs text-muted">{g.owner_email}</p>
                      {g.owner_phone && <p className="text-xs text-muted">{g.owner_phone}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={SUBSCRIPTION_STATUS[g.sub].tone}>{SUBSCRIPTION_STATUS[g.sub].label}</Badge>
                      <p className="mt-1 text-xs text-muted">
                        {g.paid_until ? `Paid until ${formatDate(g.paid_until)}` : `Trial until ${formatDate(g.trial_ends_at)}`}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{g.staff}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{g.members}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{g.active_members}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{g.checkins_30d}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatUSD(g.collected_30d)}</td>
                    <td className="px-5 py-3 text-muted">{g.last_checkin_at ? formatDate(g.last_checkin_at) : "Never"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Dialog label="Record payment" title={`Payment from ${g.name}`} description={`$${PRICE_USD} a month. Extends their subscription from today or its current end, whichever is later.`} triggerClassName="h-8 px-3 text-xs whitespace-nowrap">
                          <RecordPaymentForm action={recordSubscriptionPayment.bind(null, g.gym_id)} />
                        </Dialog>
                        <Dialog label="Extend trial" title={`Extend ${g.name}'s trial`} variant="secondary" triggerClassName="h-8 px-3 text-xs whitespace-nowrap">
                          <ExtendTrialForm action={extendTrial.bind(null, g.gym_id)} />
                        </Dialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">How gyms pay for Gymix</h2>
        <p className="mb-4 text-sm text-muted">${PRICE_USD} a month per gym after a free trial. Record each payment above to extend that gym.</p>
        <PlatformSettingsForm instructions={settings.instructions} whatsapp={settings.whatsapp} />
      </Card>
    </div>
  );
}
