"use client";

import { useDialogAction } from "@/components/dialog";
import { AffixInput } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function OccupancySettingsForm({ action, capacity, visit }: { action: Action; capacity: number | null; visit: number }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Capacity" optional hint="The most people your gym should hold. Members see Full when it's reached.">
          <AffixInput suffix="people" name="capacity" inputMode="numeric" defaultValue={capacity ?? ""} placeholder="e.g. 120" />
        </Field>
        <Field label="A usual visit lasts" hint="Used to estimate who's still inside when you don't track exits.">
          <AffixInput suffix="min" name="avg_visit_minutes" inputMode="numeric" defaultValue={visit} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

export function SensorForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name">
        <input name="name" required maxLength={60} placeholder="e.g. Entrance counter" className={inputClass} autoFocus />
      </Field>
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Adding…" : "Add counter"}</Button>
      </div>
    </form>
  );
}
