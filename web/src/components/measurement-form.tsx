"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

const MAIN = [
  { name: "weight_kg", label: "Weight (kg)", placeholder: "72.5" },
  { name: "body_fat_pct", label: "Body fat (%)", placeholder: "22.0" },
  { name: "muscle_mass_kg", label: "Muscle mass (kg)", placeholder: "31.4" },
];
const TAPE = [
  { name: "waist_cm", label: "Waist (cm)" },
  { name: "chest_cm", label: "Chest (cm)" },
  { name: "hips_cm", label: "Hips (cm)" },
  { name: "arm_cm", label: "Arm (cm)" },
  { name: "thigh_cm", label: "Thigh (cm)" },
];

export function MeasurementForm({
  action,
  today,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  today: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Date">
          <input name="measured_on" type="date" required defaultValue={today} max={today} className={inputClass} />
        </Field>
        {MAIN.map((f) => (
          <Field key={f.name} label={f.label}>
            <input name={f.name} inputMode="decimal" placeholder={f.placeholder} className={inputClass} />
          </Field>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Tape measurements (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          {TAPE.map((f) => (
            <Field key={f.name} label={f.label}>
              <input name={f.name} inputMode="decimal" className={inputClass} />
            </Field>
          ))}
        </div>
      </details>
      <Field label="Notes (optional)" hint="Tip: weigh in the morning, before training, for comparable numbers.">
        <input name="notes" maxLength={500} placeholder="e.g. From the gym's InBody scan" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save measurement"}
      </Button>
    </form>
  );
}
