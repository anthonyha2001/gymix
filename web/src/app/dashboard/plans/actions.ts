"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { PLAN_PERIODS, type PlanPeriod } from "@/lib/format";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";

function readPlan(formData: FormData) {
  const name = text(formData, "name");
  const price = money(formData, "price_usd");
  const periodCount = Number(text(formData, "period_count") || "1");
  const period = text(formData, "period") as PlanPeriod;
  const visitRaw = text(formData, "visit_limit");
  const visitLimit = visitRaw ? Number(visitRaw) : null;
  const description = text(formData, "description");

  if (!name) return { error: "Give the plan a name." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid price." };
  if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 36) {
    return { error: "Length must be between 1 and 36." };
  }
  if (!PLAN_PERIODS.some((p) => p.value === period)) return { error: "Choose days, weeks, months or years." };
  if (visitLimit !== null && (!Number.isInteger(visitLimit) || visitLimit < 1 || visitLimit > 1000)) {
    return { error: "Visit limit must be a whole number between 1 and 1000, or empty for unlimited." };
  }
  return {
    plan: {
      name,
      price_usd: price,
      period,
      period_count: periodCount,
      visit_limit: visitLimit,
      description: description || null,
    },
  };
}

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const parsed = readPlan(formData);
  if (!parsed.plan) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("membership_plans").insert({ ...parsed.plan, gym_id: membership.gymId });
  if (error) return { error: errorMessage(error, "Couldn't save the plan.") };

  refresh();
  return { success: `Plan “${parsed.plan.name}” created.` };
}

export async function updatePlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const parsed = readPlan(formData);
  if (!parsed.plan) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("membership_plans")
    .update(parsed.plan)
    .eq("id", planId)
    .eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save the plan.") };

  refresh();
  return { success: "Saved." };
}

export async function setPlanActive(planId: string, isActive: boolean) {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  await supabase
    .from("membership_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .eq("gym_id", membership.gymId);
  refresh();
}
