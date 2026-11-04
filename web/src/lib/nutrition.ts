import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const NUTRITION_GOALS = [
  { value: "lose_fat", label: "Lose fat" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "maintain", label: "Maintain weight" },
  { value: "health", label: "Eat healthier" },
  { value: "performance", label: "Sports performance" },
] as const;
export type NutritionGoal = (typeof NUTRITION_GOALS)[number]["value"];
export const NUTRITION_GOAL_LABELS = Object.fromEntries(NUTRITION_GOALS.map((g) => [g.value, g.label])) as Record<string, string>;

export const ACTIVITY_LEVELS = [
  { value: "low", label: "Low (desk job, little exercise)" },
  { value: "moderate", label: "Moderate (training 3-4 days a week)" },
  { value: "high", label: "High (training most days or physical job)" },
] as const;
export const ACTIVITY_LABELS: Record<string, string> = { low: "Low activity", moderate: "Moderate activity", high: "High activity" };

export const PLAN_STATUS: Record<string, { label: string; tone: "amber" | "green" | "gray" }> = {
  draft: { label: "Draft", tone: "amber" },
  active: { label: "Active", tone: "green" },
  archived: { label: "Old", tone: "gray" },
};

export type NutritionMeal = {
  id: string;
  position: number;
  name: string;
  time_label: string | null;
  items: string;
  calories: number | null;
};

export type NutritionPlan = {
  id: string;
  gym_id: string;
  member_id: string;
  request_id: string | null;
  name: string;
  status: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_l: number | null;
  guidelines: string | null;
  sent_at: string | null;
  updated_at: string;
  meals: NutritionMeal[];
};

export async function loadNutritionPlan(supabase: Supabase, planId: string): Promise<NutritionPlan | null> {
  const { data } = await supabase
    .from("nutrition_plans")
    .select(
      "id, gym_id, member_id, request_id, name, status, calories, protein_g, carbs_g, fat_g, water_l, guidelines, sent_at, updated_at, nutrition_meals(id, position, name, time_label, items, calories)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!data) return null;
  const { nutrition_meals, ...plan } = data;
  return {
    ...plan,
    water_l: plan.water_l === null ? null : Number(plan.water_l),
    meals: [...(nutrition_meals ?? [])].sort((a, b) => a.position - b.position),
  };
}

// Calories implied by the macro targets (4 kcal/g protein and carbs, 9 kcal/g fat).
export function macroCalories(p: { protein_g: number | null; carbs_g: number | null; fat_g: number | null }) {
  if (p.protein_g === null && p.carbs_g === null && p.fat_g === null) return null;
  return 4 * (p.protein_g ?? 0) + 4 * (p.carbs_g ?? 0) + 9 * (p.fat_g ?? 0);
}
