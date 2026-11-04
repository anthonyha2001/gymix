import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { formatUSD, planLength } from "@/lib/format";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { RowMenu } from "@/components/row-menu";
import { createPlan, deletePlan, setPlanActive, updatePlan } from "./actions";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Membership plans"
        description="What you sell at the front desk. Prices are in USD."
        action={
          <Dialog label="New plan" icon={<Plus className="size-4" />} title="New plan" description="Monthly, yearly, or a punch card with a visit limit.">
            <PlanForm action={createPlan} submitLabel="Create plan" />
          </Dialog>
        }
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <PlansTable />
      </Suspense>
    </div>
  );
}

async function PlansTable() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("gym_id", membership.gymId)
    .order("is_active", { ascending: false })
    .order("price_usd");

  if (!plans?.length) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium">No plans yet</p>
        <p className="mt-1 text-sm text-muted">Use “New plan” — most gyms start with Monthly, 3 Months and Yearly.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Length</th>
              <th className="px-5 py-3 font-medium">Visits</th>
              <th className="px-5 py-3 text-right font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plans.map((plan) => (
              <tr key={plan.id} className={plan.is_active ? "" : "text-muted"}>
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{plan.name}</p>
                  {plan.description && <p className="text-xs text-muted">{plan.description}</p>}
                </td>
                <td className="px-5 py-3">{planLength(plan.period, plan.period_count)}</td>
                <td className="px-5 py-3">{plan.visit_limit ? `${plan.visit_limit} visits` : "Unlimited"}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">{formatUSD(plan.price_usd)}</td>
                <td className="px-5 py-3">{plan.is_active ? <Badge tone="green">On sale</Badge> : <Badge tone="gray">Archived</Badge>}</td>
                <td className="px-5 py-3 text-right">
                  <RowMenu
                    label={`Actions for ${plan.name}`}
                    items={[
                      {
                        kind: "dialog",
                        label: "Edit",
                        title: `Edit ${plan.name}`,
                        content: (
                          <PlanForm
                            action={updatePlan.bind(null, plan.id)}
                            initial={{ ...plan, price_usd: Number(plan.price_usd) }}
                            submitLabel="Save changes"
                          />
                        ),
                      },
                      {
                        kind: "action",
                        label: plan.is_active ? "Archive (stop selling)" : "Restore",
                        action: setPlanActive.bind(null, plan.id, !plan.is_active),
                      },
                      {
                        kind: "action",
                        label: "Delete",
                        danger: true,
                        action: deletePlan.bind(null, plan.id),
                        confirm: `Delete “${plan.name}”? Memberships already sold keep their plan name.`,
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
