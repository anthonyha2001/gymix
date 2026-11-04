import type { Metadata } from "next";
import { Suspense } from "react";
import { Apple } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { NutritionPlanView } from "@/components/nutrition-plan-view";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, Card, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { NUTRITION_GOAL_LABELS, loadNutritionPlan } from "@/lib/nutrition";
import { requirePortalPage } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { cancelNutritionRequest } from "@/app/nutrition-actions";
import { ActionButton } from "../../dashboard/members/action-button";
import { RequestNutritionForm } from "./forms";

export const metadata: Metadata = { title: "Nutrition" };

const TABS = ["plan", "requests"] as const;
const BASE = "/portal/nutrition";

export default function NutritionPage({ searchParams }: PageProps<"/portal/nutrition">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Nutrition searchParams={searchParams} />
    </Suspense>
  );
}

async function Nutrition({ searchParams }: { searchParams: PageProps<"/portal/nutrition">["searchParams"] }) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const { viewer, membership } = await requirePortalPage("nutrition");
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet.</Card>;

  const [{ data: active }, { data: requests }, { data: staff }] = await Promise.all([
    supabase.from("nutrition_plans").select("id, dietitian_id, sent_at").eq("member_id", me.id).eq("status", "active").maybeSingle(),
    supabase
      .from("nutrition_requests")
      .select("id, goal, status, created_at")
      .eq("member_id", me.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("gym_staff_names", { p_gym_id: membership.gymId }),
  ]);
  const plan = active ? await loadNutritionPlan(supabase, active.id) : null;
  const dietitian = staff?.find((s) => s.id === active?.dietitian_id)?.full_name;
  const openRequest = requests?.find((r) => r.status === "open" || r.status === "in_progress");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
        {!openRequest && (
          <Dialog
            label={plan ? "Ask for a new plan" : "Ask the dietitian"}
            variant={plan ? "secondary" : "primary"}
            title="Ask for a nutrition plan"
            description="Your dietitian builds a meal plan around your goal and what you like to eat."
            size="lg"
            triggerClassName="h-9"
          >
            <RequestNutritionForm />
          </Dialog>
        )}
      </div>

      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={[
          { id: "plan", label: "My plan" },
          { id: "requests", label: "Requests", count: openRequest ? 1 : 0 },
        ]}
      />

      <TabPanel id="plan" tabs={TABS}>{(plan ? (
          <div className="space-y-4">
            <Card className="bg-ink p-5 text-white">
              <p className="text-sm text-white/70">Your nutrition plan</p>
              <p className="text-xl font-semibold">{plan.name}</p>
              <p className="text-sm text-white/70">
                {dietitian ? `From ${dietitian}` : "From your dietitian"}
                {active?.sent_at && ` · ${formatDate(active.sent_at)}`}
              </p>
            </Card>
            <NutritionPlanView plan={plan} />
          </div>
        ) : (
          <Card className="space-y-2 p-8 text-center">
            <Apple className="mx-auto size-8 text-muted" />
            <p className="font-medium">No nutrition plan yet</p>
            <p className="text-sm text-muted">
              {openRequest ? "Your request is with the dietitian. Your plan shows here once it's ready." : "Ask the dietitian and your meal plan shows up here."}
            </p>
          </Card>
        ))}</TabPanel>

      <TabPanel id="requests" tabs={TABS}>{(!requests?.length ? (
          <Card className="space-y-2 p-8 text-center">
            <p className="font-medium">No requests</p>
            <p className="text-sm text-muted">Use “Ask the dietitian” to get a meal plan.</p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium">{NUTRITION_GOAL_LABELS[r.goal]}</p>
                    <p className="text-sm text-muted">
                      Asked {formatDate(r.created_at)} ·{" "}
                      {
                        {
                          open: "waiting for the dietitian",
                          in_progress: "the dietitian is building it now",
                          done: "your plan is ready",
                          cancelled: "cancelled",
                        }[r.status]
                      }
                    </p>
                  </div>
                  {r.status === "open" && (
                    <ActionButton action={cancelNutritionRequest.bind(null, r.id)} label="Cancel request" variant="ghost" confirm="Cancel your nutrition request?" />
                  )}
                  {r.status === "done" && <Badge tone="green">Ready</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}</TabPanel>
    </div>
  );
}
