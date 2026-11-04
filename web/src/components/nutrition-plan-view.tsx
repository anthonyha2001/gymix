import { Droplets } from "lucide-react";
import { Card } from "@/components/ui";
import type { NutritionPlan } from "@/lib/nutrition";

// Read-only plan, as the member sees it: daily targets, guidelines, meals.
export function NutritionPlanView({ plan }: { plan: NutritionPlan }) {
  const targets = [
    { label: "Calories", value: plan.calories, unit: "kcal" },
    { label: "Protein", value: plan.protein_g, unit: "g" },
    { label: "Carbs", value: plan.carbs_g, unit: "g" },
    { label: "Fat", value: plan.fat_g, unit: "g" },
  ].filter((t) => t.value !== null);
  const meals = plan.meals.filter((m) => m.items.trim() !== "");

  return (
    <div className="space-y-4">
      {(targets.length > 0 || plan.water_l !== null) && (
        <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-5">
          {targets.map((t) => (
            <div key={t.label} className="bg-surface px-4 py-3">
              <p className="text-xs text-muted">{t.label}</p>
              <p className="text-xl font-semibold tabular-nums">
                {t.value?.toLocaleString("en-US")} <span className="text-sm font-normal text-muted">{t.unit}</span>
              </p>
            </div>
          ))}
          {plan.water_l !== null && (
            <div className="bg-surface px-4 py-3">
              <p className="flex items-center gap-1 text-xs text-muted">
                <Droplets className="size-3.5" /> Water
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {plan.water_l} <span className="text-sm font-normal text-muted">L</span>
              </p>
            </div>
          )}
        </Card>
      )}

      {plan.guidelines && (
        <Card className="p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Guidelines</p>
          <p className="text-sm whitespace-pre-line">{plan.guidelines}</p>
        </Card>
      )}

      <ol className="space-y-3">
        {meals.map((m) => (
          <li key={m.id}>
            <Card className="p-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="font-semibold">
                  {m.name}
                  {m.time_label && <span className="ml-2 text-sm font-normal text-muted">{m.time_label}</span>}
                </p>
                {m.calories !== null && <span className="text-sm text-muted tabular-nums">{m.calories} kcal</span>}
              </div>
              <ul className="space-y-1 text-sm">
                {m.items
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-strong" />
                      {line}
                    </li>
                  ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
