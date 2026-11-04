"use client";

import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { WEEKDAYS, hhmm } from "@/lib/schedule";
import type { ActionState } from "@/lib/action-result";
import { SearchSelect } from "@/components/search-select";

type Coach = { id: string; full_name: string };

export type ClassValues = {
  name: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  capacity: number;
  trainer_id: string | null;
  location: string | null;
  description: string | null;
  monthly_price_usd?: number | null;
};

export function ClassForm({
  action,
  coaches,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  coaches: Coach[];
  initial?: ClassValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Class">
          <input name="name" required maxLength={60} defaultValue={initial?.name} placeholder="e.g. Spinning" className={inputClass} />
        </Field>
        <Field label="Day">
          <SearchSelect name="weekday" defaultValue={initial?.weekday ?? 1} className={inputClass}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Starts at">
          <input name="start_time" type="time" required defaultValue={initial ? hhmm(initial.start_time) : "18:00"} className={inputClass} />
        </Field>
        <Field label="Length (minutes)">
          <input name="duration_min" type="number" min={10} max={240} step={5} defaultValue={initial?.duration_min ?? 60} className={inputClass} />
        </Field>
        <Field label="Spots">
          <input name="capacity" type="number" min={1} max={500} defaultValue={initial?.capacity ?? 20} className={inputClass} />
        </Field>
        <Field label="Trainer">
          <SearchSelect name="trainer_id" defaultValue={initial?.trainer_id ?? ""} className={inputClass}>
            <option value="">—</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || "Trainer"}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Room (optional)">
          <input name="location" maxLength={60} defaultValue={initial?.location ?? ""} placeholder="e.g. Studio 1" className={inputClass} />
        </Field>
        <Field label="Monthly course price (USD)" hint="Leave empty for a normal class booked per session.">
          <input
            name="monthly_price_usd"
            inputMode="decimal"
            defaultValue={initial?.monthly_price_usd ?? ""}
            placeholder="e.g. 50"
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description (optional)">
            <input name="description" maxLength={500} defaultValue={initial?.description ?? ""} className={inputClass} />
          </Field>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

// Date + time + length (+ trainer). Members request; staff book directly.
export function PtSessionForm({
  action,
  coaches,
  defaultDate,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  coaches: Coach[];
  defaultDate: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Trainer">
          <SearchSelect name="trainer_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || "Trainer"}
              </option>
            ))}
          </SearchSelect>
        </Field>
        <Field label="Date">
          <input name="date" type="date" required min={defaultDate} defaultValue={defaultDate} className={inputClass} />
        </Field>
        <Field label="Time">
          <input name="time" type="time" required defaultValue="18:00" className={inputClass} />
        </Field>
        <Field label="Length">
          <SearchSelect name="duration_min" defaultValue="60" className={inputClass}>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
          </SearchSelect>
        </Field>
      </div>
      <Field label="Note (optional)">
        <input name="note" maxLength={500} placeholder="e.g. Want to work on squat technique" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
