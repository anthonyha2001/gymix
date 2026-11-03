import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton, buttonClass } from "@/components/ui";
import { formatUSD, planLength } from "@/lib/format";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createPlan, setPlanActive, updatePlan } from "./actions";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Membership plans" description="What you sell at the front desk. Prices are in USD." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PlansContent />
      </Suspense>
    </div>
  );
}

async function PlansContent() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("gym_id", membership.gymId)
    .order("is_active", { ascending: false })
    .order("price_usd");

  return (
    <>
      <Card>
        <SectionTitle>Your plans</SectionTitle>
        {!plans?.length ? (
          <EmptyState>No plans yet. Create your first one below — most gyms start with Monthly, 3 Months and Yearly.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {plans.map((plan) => (
              <li key={plan.id} className={plan.is_active ? "" : "bg-canvas/50"}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {plan.name} {!plan.is_active && <Badge tone="gray">Archived</Badge>}
                      </p>
                      <p className="text-xs text-muted">
                        {planLength(plan.period, plan.period_count)}
                        {plan.visit_limit ? ` · ${plan.visit_limit} visits` : " · unlimited visits"}
                        {plan.description ? ` · ${plan.description}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatUSD(plan.price_usd)}</p>
                    <span className="text-sm text-muted group-open:hidden">Edit</span>
                    <span className="hidden text-sm text-muted group-open:inline">Close</span>
                  </summary>
                  <div className="space-y-4 border-t border-line px-5 py-4">
                    <PlanForm
                      action={updatePlan.bind(null, plan.id)}
                      initial={{ ...plan, price_usd: Number(plan.price_usd) }}
                      submitLabel="Save changes"
                    />
                    <form action={setPlanActive.bind(null, plan.id, !plan.is_active)}>
                      <button className={buttonClass(plan.is_active ? "danger" : "secondary", "h-9")}>
                        {plan.is_active ? "Archive plan" : "Restore plan"}
                      </button>
                      {plan.is_active && (
                        <span className="ml-3 text-xs text-muted">
                          Archived plans can&apos;t be sold. Existing memberships aren&apos;t affected.
                        </span>
                      )}
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">New plan</h2>
        <PlanForm action={createPlan} submitLabel="Create plan" />
      </Card>
    </>
  );
}
