import { Check, MessageCircle } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle, buttonClass } from "@/components/ui";
import { formatDate, formatUSD } from "@/lib/format";
import { PLAN_FEATURES, SUBSCRIPTION_STATUS, formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import { createClient } from "@/lib/supabase/server";
import { gymSubscription, platformSettings, renewLink } from "@/lib/subscription";

// The owner's view of their Gymix subscription: where it stands, how to pay,
// and what they have paid.
export async function SubscriptionPanel({ gymId, gymName }: { gymId: string; gymName: string }) {
  const supabase = await createClient();
  const [sub, settings, { data: payments }, { priceUsd }] = await Promise.all([
    gymSubscription(gymId),
    platformSettings(),
    supabase
      .from("platform_payments")
      .select("id, months, amount_usd, method, paid_until, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    getPricing(),
  ]);
  const price = formatPrice(priceUsd);
  if (!sub) return null;
  const status = SUBSCRIPTION_STATUS[sub.status];
  const wa = renewLink(settings.whatsapp, gymName);

  const headline =
    sub.status === "suspended"
      ? "Your gym's account is suspended"
      : sub.status === "trial"
      ? sub.daysLeft === 0
        ? "Your free trial ends today"
        : `${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"} left in your free trial`
      : sub.status === "active"
        ? `Paid until ${formatDate(sub.endsOn)}`
        : `Ended on ${formatDate(sub.endsOn)}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="bg-ink p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/70">Gymix subscription</p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{headline}</p>
            <p className="mt-1 text-sm text-white/70">
              {sub.status === "suspended"
                ? "Gymix has paused this gym's dashboard. Message us to sort it out. Your members can still use their app."
                : sub.status === "active"
                ? "Pay again before this date to keep going without a break."
                : sub.status === "trial"
                  ? `Everything is included during the trial. After ${formatDate(sub.trialEndsAt)} it's ${price} a month.`
                  : "The dashboard is locked until you renew. Your members can still use their app."}
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{price}</span>
              <span className="text-muted">/ month for your whole gym</span>
            </div>
            <h3 className="font-semibold">How to pay</h3>
            {settings.instructions ? (
              <p className="whitespace-pre-line rounded-xl bg-canvas p-4 text-sm">{settings.instructions}</p>
            ) : (
              <p className="rounded-xl bg-canvas p-4 text-sm text-muted">Message us and we&apos;ll send you the payment details.</p>
            )}
            <p className="text-sm text-muted">
              Pay for one month or several at once. Once we receive it, your subscription is extended and you get a
              notification.
            </p>
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className={buttonClass("primary", "h-11 px-5")}>
                <MessageCircle className="size-4" /> Message Gymix on WhatsApp
              </a>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Everything included</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionTitle>Payments to Gymix</SectionTitle>
        {!payments?.length ? (
          <EmptyState>No payments yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="block font-medium">
                    {p.months} month{p.months === 1 ? "" : "s"} · {formatUSD(p.amount_usd)}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatDate(p.created_at)} · {p.method}
                  </span>
                </span>
                <span className="text-xs text-muted">Paid until {formatDate(p.paid_until)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
