import Link from "next/link";
import { AlertTriangle, Lock, Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import { requireStaff } from "@/lib/session";
import { gymSubscription, platformSettings, renewLink } from "@/lib/subscription";
import { OwnerSubscriptionOnly } from "./subscription-gate-client";

const SUBSCRIPTION_TAB = "/dashboard/settings?tab=subscription";

// Wraps every dashboard page: a reminder while the trial is ending or payment
// is due, and a lock once the subscription has ended (the owner can still
// open the Subscription tab to renew).
export async function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { membership } = await requireStaff();
  const sub = await gymSubscription(membership.gymId);
  if (!sub) return <>{children}</>;
  const isOwner = membership.role === "owner";
  const { priceUsd, graceDays } = await getPricing();
  const price = formatPrice(priceUsd);

  if (sub.status === "expired" || sub.status === "suspended") {
    const suspended = sub.status === "suspended";
    const { whatsapp } = await platformSettings();
    const wa = renewLink(whatsapp, membership.gymName);
    const lock = (
      <div className="mx-auto max-w-lg py-10">
        <div role="alert" className="overflow-hidden rounded-3xl border border-line bg-surface text-center shadow-sm">
          <div className="bg-ink px-6 py-8 text-white">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand text-ink">
              <Lock className="size-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              {suspended ? "This gym's account is suspended" : "Your Gymix subscription has ended"}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              {suspended ? "Gymix has paused this dashboard." : `It ended on ${formatDate(sub.endsOn)}.`} Your data is safe and nothing was deleted.
            </p>
          </div>
          <div className="space-y-4 p-6 text-sm">
            {isOwner ? (
              <>
                <p>
                  {suspended
                    ? "Message Gymix to get it reopened. Your members can still use their app meanwhile."
                    : `Renew for ${price} a month to open the dashboard again. Your members can still use their app meanwhile.`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={SUBSCRIPTION_TAB} className={buttonClass("primary", "h-11 px-5")}>
                    How to pay
                  </Link>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener" className={buttonClass("secondary", "h-11 px-5")}>
                      Message Gymix on WhatsApp
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p>
                {suspended ? "Ask your gym owner to contact Gymix." : "Ask your gym owner to renew the subscription."} Your members
                can still use their app meanwhile.
              </p>
            )}
          </div>
        </div>
      </div>
    );
    return isOwner ? <OwnerSubscriptionOnly lock={lock}>{children}</OwnerSubscriptionOnly> : lock;
  }

  let banner: React.ReactNode = null;
  if (sub.status === "grace") {
    const lockIn = graceDays + sub.daysLeft + 1;
    banner = (
      <Banner tone="amber" icon={<AlertTriangle className="size-4" />}>
        Your Gymix subscription ended on {formatDate(sub.endsOn)}.{" "}
        {isOwner ? (
          <>
            The dashboard locks in {lockIn} day{lockIn === 1 ? "" : "s"}.{" "}
            <Link href={SUBSCRIPTION_TAB} className="font-semibold underline underline-offset-4">
              Renew now
            </Link>
          </>
        ) : (
          <>Ask your gym owner to renew it.</>
        )}
      </Banner>
    );
  } else if (sub.status === "trial" && isOwner && sub.daysLeft <= 7) {
    banner = (
      <Banner tone="brand" icon={<Sparkles className="size-4" />}>
        {sub.daysLeft === 0 ? "Your free trial ends today." : `${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
        <Link href={SUBSCRIPTION_TAB} className="font-semibold underline underline-offset-4">
          Subscribe for {price}/month
        </Link>
      </Banner>
    );
  }

  return (
    <>
      {banner}
      {children}
    </>
  );
}

function Banner({ tone, icon, children }: { tone: "amber" | "brand"; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-brand-strong/40 bg-brand/25 text-ink";
  return (
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
