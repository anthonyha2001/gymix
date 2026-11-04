"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { showToast } from "@/components/toaster";
import { Alert, Button, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { macroCalories, type NutritionMeal, type NutritionPlan } from "@/lib/nutrition";
import type { ActionState } from "@/lib/action-result";
import { addMeal, deleteMeal, saveNutritionPlan } from "@/app/nutrition-actions";

// The dietitian's editor: daily targets and every meal in one form, saved
// with one button (and, for a draft, "Save and send").
export function NutritionEditor({ plan }: { plan: NutritionPlan }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveNutritionPlan(plan.id, prev, formData);
    if (result.success) showToast(result.success);
    return result;
  }, {});
  const [macros, setMacros] = useState({ protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g });
  const [, startTransition] = useTransition();
  const fromMacros = macroCalories(macros);
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Card className="space-y-4 p-5">
        <Field label="Plan name">
          <input name="name" defaultValue={plan.name} maxLength={80} required className={`${inputClass} font-semibold`} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Calories / day">
            <input name="calories" inputMode="numeric" defaultValue={plan.calories ?? ""} placeholder="2000" className={inputClass} />
          </Field>
          <Field label="Protein (g)">
            <input name="protein_g" inputMode="numeric" defaultValue={plan.protein_g ?? ""} onChange={(e) => setMacros((m) => ({ ...m, protein_g: num(e.target.value) }))} className={inputClass} />
          </Field>
          <Field label="Carbs (g)">
            <input name="carbs_g" inputMode="numeric" defaultValue={plan.carbs_g ?? ""} onChange={(e) => setMacros((m) => ({ ...m, carbs_g: num(e.target.value) }))} className={inputClass} />
          </Field>
          <Field label="Fat (g)">
            <input name="fat_g" inputMode="numeric" defaultValue={plan.fat_g ?? ""} onChange={(e) => setMacros((m) => ({ ...m, fat_g: num(e.target.value) }))} className={inputClass} />
          </Field>
          <Field label="Water (L)">
            <input name="water_l" inputMode="decimal" defaultValue={plan.water_l ?? ""} placeholder="2.5" className={inputClass} />
          </Field>
        </div>
        {fromMacros !== null && fromMacros > 0 && <p className="text-xs text-muted">The macros add up to {fromMacros.toLocaleString("en-US")} kcal.</p>}
        <Field label="Guidelines for the member">
          <textarea
            name="guidelines"
            defaultValue={plan.guidelines ?? ""}
            maxLength={2000}
            rows={3}
            placeholder="e.g. No sugary drinks. Grill instead of frying. One free meal on Sunday."
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Meals</h3>
        {plan.meals.map((m) => (
          <MealFields key={m.id} meal={m} />
        ))}
        <button type="button" onClick={() => startTransition(() => addMeal(plan.id))} className={buttonClass("secondary", "w-full border-dashed")}>
          <Plus className="size-4" /> Add a meal
        </button>
      </div>

      {/* One save for everything, always in reach. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <Button type="submit" name="intent" value="save" variant={plan.status === "draft" ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Saving…" : "Save plan"}
        </Button>
        {plan.status === "draft" && (
          <Button type="submit" name="intent" value="send" disabled={pending}>
            Save and send to member
          </Button>
        )}
      </div>
    </form>
  );
}

function MealFields({ meal }: { meal: NutritionMeal }) {
  const [, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  const f = (k: string) => `meal.${meal.id}.${k}`;

  return (
    <Card className="space-y-3 p-4">
      {confirmDialog}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Meal">
          <input name={f("name")} defaultValue={meal.name} maxLength={60} required aria-label="Meal name" className={`${inputClass} w-40 font-semibold`} />
        </Field>
        <Field label="Time">
          <input name={f("time_label")} defaultValue={meal.time_label ?? ""} maxLength={20} placeholder="08:00" className={`${inputClass} w-24`} />
        </Field>
        <Field label="kcal">
          <input name={f("calories")} inputMode="numeric" defaultValue={meal.calories ?? ""} className={`${inputClass} w-24`} />
        </Field>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={`Delete ${meal.name}`}
          onClick={async () => {
            if (await confirm(`Delete “${meal.name}”?`, { danger: true, confirmLabel: "Delete meal" })) startTransition(() => deleteMeal(meal.id));
          }}
          className={buttonClass("ghost", "h-10 px-2 text-muted hover:text-danger")}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <textarea
        name={f("items")}
        defaultValue={meal.items}
        maxLength={2000}
        rows={3}
        aria-label={`${meal.name} foods`}
        placeholder={"One food per line, e.g.\n3 egg whites + 1 whole egg\n1 slice brown bread\nCucumber and tomato"}
        className={`${inputClass} h-auto py-2`}
      />
    </Card>
  );
}
