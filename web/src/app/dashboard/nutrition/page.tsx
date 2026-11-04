import type { Metadata } from "next";
import { HoverLink } from "@/components/hover-link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { NutritionEditorModal } from "@/components/nutrition-editor-modal";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { ACTIVITY_LABELS, NUTRITION_GOAL_LABELS, PLAN_STATUS } from "@/lib/nutrition";
import { DIET_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../members/action-button";
import { archiveNutritionPlan, cancelNutritionRequest, removeNutritionPlan, startNutritionPlan } from "@/app/nutrition-actions";
import { StartNutritionForm } from "./forms";

export const metadata: Metadata = { title: "Nutrition" };

const TABS = ["requests", "plans"] as const;
const BASE = "/dashboard/nutrition";

export default function NutritionPage({ searchParams }: PageProps<"/dashboard/nutrition">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <NutritionContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NutritionContent({ searchParams }: { searchParams: PageProps<"/dashboard/nutrition">["searchParams"] }) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const here = `${BASE}?tab=${tab}`;
  const openPlan = typeof query.plan === "string" ? query.plan : null;

  const { membership } = await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  const [{ data: requests }, { data: plans }, { data: members }] = await Promise.all([
    supabase
      .from("nutrition_requests")
      .select(
        "id, member_id, goal, weight_kg, height_cm, activity, allergies, preferences, notes, status, plan_id, created_at, members(full_name), dietitian:profiles!nutrition_requests_dietitian_id_fkey(full_name)",
      )
      .eq("gym_id", membership.gymId)
      .in("status", ["open", "in_progress"])
      .order("created_at"),
    supabase
      .from("nutrition_plans")
      .select("id, name, status, calories, updated_at, member_id, members(full_name)")
      .eq("gym_id", membership.gymId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("members").select("id, full_name").eq("gym_id", membership.gymId).is("archived_at", null).order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nutrition"
        description="Answer members' nutrition requests and build their meal plans."
        action={
          <Dialog label="New plan" icon={<Plus className="size-4" />} title="New nutrition plan" description="For one member.">
            <StartNutritionForm action={startNutritionPlan.bind(null, null, null, `${BASE}?tab=plans`)} members={members ?? []} />
          </Dialog>
        }
      />

      <PageTabs instant
        base={BASE}
        active={tab}
        tabs={[
          { id: "requests", label: "Requests", count: requests?.length ?? 0 },
          { id: "plans", label: "Plans" },
        ]}
      />

      {openPlan && <NutritionEditorModal planId={openPlan} gymId={membership.gymId} closePath={here} />}

      <TabPanel id="requests" tabs={TABS}>{(
        <Card>
          <SectionTitle>Requests from members</SectionTitle>
          {!requests?.length ? (
            <EmptyState>No open requests. Members ask for a nutrition plan from their portal.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {requests.map((r) => (
                <li key={r.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <HoverLink href={`/dashboard/members/${r.member_id}?tab=nutrition`} className="font-semibold hover:underline">
                        {r.members?.full_name}
                      </HoverLink>
                      <p className="text-sm">
                        {NUTRITION_GOAL_LABELS[r.goal]} · {ACTIVITY_LABELS[r.activity]}
                        {r.weight_kg && ` · ${Number(r.weight_kg)} kg`}
                        {r.height_cm && ` · ${Number(r.height_cm)} cm`}
                      </p>
                      {r.allergies && <p className="text-sm text-danger">Allergies: {r.allergies}</p>}
                      {r.preferences && <p className="text-sm">Preferences: {r.preferences}</p>}
                      {r.notes && <p className="text-sm text-muted">“{r.notes}”</p>}
                      <p className="mt-1 text-xs text-muted">
                        Asked {formatDate(r.created_at)}
                        {r.dietitian?.full_name && ` · ${r.dietitian.full_name} is on it`}
                      </p>
                    </div>
                    {r.status === "in_progress" ? <Badge tone="amber">In progress</Badge> : <Badge tone="red">New</Badge>}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {r.status === "open" ? (
                      <Dialog label="Build plan" title={`Nutrition plan for ${r.members?.full_name ?? "member"}`} triggerClassName="h-9">
                        <StartNutritionForm action={startNutritionPlan.bind(null, r.member_id, r.id, here)} />
                      </Dialog>
                    ) : (
                      r.plan_id && (
                        <HoverLink href={`${BASE}?tab=requests&plan=${r.plan_id}`} scroll={false} className="inline-flex h-9 items-center text-sm font-medium underline underline-offset-4">
                          Continue building
                        </HoverLink>
                      )
                    )}
                    <ActionButton
                      action={cancelNutritionRequest.bind(null, r.id)}
                      label="Close without a plan"
                      variant="ghost"
                      className="h-9"
                      confirm="Close this request without a plan?"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}</TabPanel>

      <TabPanel id="plans" tabs={TABS}>{(
        <Card>
          <SectionTitle>Nutrition plans</SectionTitle>
          {!plans?.length ? (
            <EmptyState>No plans yet. Start one from a request, or with “New plan”.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {plans.map((p) => {
                const status = PLAN_STATUS[p.status] ?? PLAN_STATUS.draft;
                return (
                  <li key={p.id} className="flex items-center pr-3 hover:bg-canvas/50">
                    <HoverLink href={`${BASE}?tab=plans&plan=${p.id}`} scroll={false} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-muted">
                          {p.members?.full_name}
                          {p.calories && ` · ${p.calories} kcal`} · updated {formatDate(p.updated_at)}
                        </span>
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </HoverLink>
                    <RowMenu
                      label={`Actions for ${p.name}`}
                      items={[
                        { kind: "link", label: "Open", href: `${BASE}?tab=plans&plan=${p.id}` },
                        p.status === "active" && { kind: "action", label: "Archive", action: archiveNutritionPlan.bind(null, p.id) },
                        p.status !== "active" && {
                          kind: "action",
                          label: "Delete",
                          danger: true,
                          action: removeNutritionPlan.bind(null, p.id),
                          confirm: `Delete “${p.name}”?`,
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}</TabPanel>
    </div>
  );
}
