"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireStaff } from "@/lib/session";
import { DIET_ROLES } from "@/lib/roles";
import { NUTRITION_GOALS } from "@/lib/nutrition";
import { withParam } from "@/lib/url";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

function intOrNull(formData: FormData, key: string) {
  const v = text(formData, key);
  if (!v) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
}

// --- Dietitian -------------------------------------------------------------

// Starts a draft plan for a member (optionally answering their request), then
// opens it in the editor dialog on the page the dietitian is on.
export async function startNutritionPlan(
  memberId: string | null,
  requestId: string | null,
  returnPath: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(DIET_ROLES);
  const member = memberId ?? text(formData, "member_id");
  if (!member) return { error: "Choose the member this plan is for." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_nutrition_plan", { p_member_id: member, p_request_id: requestId ?? undefined });
  if (error || !data) return { error: errorMessage(error ?? { message: "" }, "Couldn't start the plan.") };
  redirect(withParam(returnPath, "plan", data));
}

// Saves the whole plan in one go: targets, guidelines and every meal
// (fields named meal.<id>.<field>). intent=send also sends a draft to the member.
export async function saveNutritionPlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(DIET_ROLES);
  const name = text(formData, "name");
  if (!name) return { error: "Name the plan." };
  const values = {
    calories: intOrNull(formData, "calories"),
    protein_g: intOrNull(formData, "protein_g"),
    carbs_g: intOrNull(formData, "carbs_g"),
    fat_g: intOrNull(formData, "fat_g"),
  };
  if (Object.values(values).some((v) => Number.isNaN(v))) return { error: "Targets must be whole numbers." };
  if (values.calories !== null && (values.calories < 800 || values.calories > 6000)) return { error: "Daily calories should be between 800 and 6000." };
  const water = text(formData, "water_l");
  const water_l = water ? Number(water) : null;
  if (water_l !== null && (!Number.isFinite(water_l) || water_l < 0 || water_l > 10)) return { error: "Water is in litres, e.g. 2.5." };

  const mealIds = [...new Set([...formData.keys()].filter((k) => k.startsWith("meal.")).map((k) => k.split(".")[1]))];
  const meals = [];
  for (const id of mealIds) {
    const mealName = text(formData, `meal.${id}.name`);
    if (!mealName) return { error: "Every meal needs a name, e.g. Breakfast." };
    const calories = intOrNull(formData, `meal.${id}.calories`);
    if (Number.isNaN(calories)) return { error: `Calories for ${mealName} must be a number.` };
    meals.push({ id, name: mealName, time_label: text(formData, `meal.${id}.time_label`) || null, items: text(formData, `meal.${id}.items`), calories });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("nutrition_plans")
    .update({ name, ...values, water_l, guidelines: text(formData, "guidelines") || null })
    .eq("id", planId);
  if (error) return { error: errorMessage(error, "Couldn't save the plan.") };
  const results = await Promise.all(
    meals.map(({ id, ...m }) => supabase.from("nutrition_meals").update(m).eq("id", id).eq("plan_id", planId)),
  );
  const mealError = results.find((r) => r.error)?.error;
  if (mealError) return { error: errorMessage(mealError, "Couldn't save the meals.") };

  if (formData.get("intent") === "send") {
    const { error: sendError } = await supabase.rpc("send_nutrition_plan", { p_plan_id: planId });
    if (sendError) return { error: errorMessage(sendError, "Saved, but couldn't send the plan.") };
    refresh();
    return { success: "Saved and sent. The member sees it in their portal now." };
  }
  refresh();
  return { success: "Plan saved." };
}

export async function addMeal(planId: string) {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("nutrition_meals")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;
  await supabase.from("nutrition_meals").insert({ plan_id: planId, position, name: `Meal ${position + 1}` });
  refresh();
}

export async function deleteMeal(mealId: string) {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  await supabase.from("nutrition_meals").delete().eq("id", mealId);
  refresh();
}

export async function sendNutritionPlan(planId: string): Promise<ActionState> {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_nutrition_plan", { p_plan_id: planId });
  if (error) return { error: errorMessage(error, "Couldn't send the plan.") };
  refresh();
  return { success: "Sent. The member sees it in their portal now." };
}

export async function archiveNutritionPlan(planId: string): Promise<ActionState> {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_nutrition_plan", { p_plan_id: planId });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Plan archived." };
}

export async function deleteNutritionPlan(planId: string, closePath: string) {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  await supabase.from("nutrition_plans").delete().eq("id", planId);
  redirect(closePath);
}

export async function removeNutritionPlan(planId: string): Promise<ActionState> {
  await requireStaff(DIET_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_plans").delete().eq("id", planId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Plan deleted." };
}

// Staff closes a request, or the member withdraws their own.
export async function cancelNutritionRequest(requestId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_nutrition_request", { p_request_id: requestId });
  if (error) return { error: errorMessage(error, "Couldn't close the request.") };
  refresh();
  return { success: "Request closed." };
}

// --- Member ----------------------------------------------------------------

export async function requestNutritionPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireMember();
  const goal = text(formData, "goal");
  if (!NUTRITION_GOALS.some((g) => g.value === goal)) return { error: "Choose your goal." };
  const weight = text(formData, "weight_kg");
  const height = text(formData, "height_cm");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_nutrition_plan", {
    p_gym_id: membership.gymId,
    p_goal: goal,
    p_weight_kg: weight ? Number(weight) : undefined,
    p_height_cm: height ? Number(height) : undefined,
    p_activity: text(formData, "activity") || "moderate",
    p_allergies: text(formData, "allergies") || undefined,
    p_preferences: text(formData, "preferences") || undefined,
    p_notes: text(formData, "notes") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't send your request.") };
  refresh();
  return { success: "Request sent. Your dietitian will build your plan." };
}
