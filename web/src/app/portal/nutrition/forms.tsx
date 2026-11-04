"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { ACTIVITY_LEVELS, NUTRITION_GOALS } from "@/lib/nutrition";
import { requestNutritionPlan } from "@/app/nutrition-actions";
import { SearchSelect } from "@/components/search-select";

export function RequestNutritionForm() {
  const [state, action, pending] = useDialogAction(requestNutritionPlan, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your goal">
          <SearchSelect name="goal" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a goal
            </option>
            {NUTRITION_GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Activity">
          <SearchSelect name="activity" defaultValue="moderate" className={inputClass}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Weight (kg)">
          <input name="weight_kg" inputMode="decimal" placeholder="e.g. 82" className={inputClass} />
        </Field>
        <Field label="Height (cm)">
          <input name="height_cm" inputMode="decimal" placeholder="e.g. 178" className={inputClass} />
        </Field>
      </div>
      <Field label="Allergies or foods you can't eat (optional)">
        <input name="allergies" maxLength={500} placeholder="e.g. Peanuts, lactose" className={inputClass} />
      </Field>
      <Field label="Preferences (optional)">
        <input name="preferences" maxLength={500} placeholder="e.g. Vegetarian, no fish, I eat out at lunch" className={inputClass} />
      </Field>
      <Field label="Anything else (optional)">
        <textarea name="notes" maxLength={1000} rows={2} className={`${inputClass} h-auto py-2`} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
