"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { AffixInput, ChoiceChips, DateField, FormSection, Stepper } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { addDays } from "@/lib/format";
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

// Monday first, as gyms plan their week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LENGTHS = [30, 45, 60, 75, 90];

const lengthLabel = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m} min`);

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
  const [course, setCourse] = useState(initial?.monthly_price_usd != null);
  const lengths = initial && !LENGTHS.includes(initial.duration_min) ? [...LENGTHS, initial.duration_min].sort((a, b) => a - b) : LENGTHS;

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <Field label="Class">
        <input name="name" required maxLength={60} autoFocus={!initial} defaultValue={initial?.name} placeholder="e.g. Spinning" className={inputClass} />
      </Field>

      <FormSection title="When">
        <Field label="Day" group hint="It repeats every week.">
          <ChoiceChips
            name="weekday"
            label="Day"
            defaultValue={String(initial?.weekday ?? 1)}
            options={WEEK_ORDER.map((d) => ({ value: String(d), label: WEEKDAYS[d].slice(0, 3) }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Starts at">
            <input name="start_time" type="time" required defaultValue={initial ? hhmm(initial.start_time) : "18:00"} className={inputClass} />
          </Field>
          <Field label="Length" group>
            <ChoiceChips
              name="duration_min"
              label="Length"
              defaultValue={String(initial?.duration_min ?? 60)}
              options={lengths.map((m) => ({ value: String(m), label: lengthLabel(m) }))}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Who and where">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Spots" group>
            <Stepper name="capacity" label="Spots" defaultValue={initial?.capacity ?? 20} min={1} max={500} />
          </Field>
          <Field label="Trainer">
            <SearchSelect name="trainer_id" defaultValue={initial?.trainer_id ?? ""} className={inputClass}>
              <option value="">No trainer</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || "Trainer"}
                </option>
              ))}
            </SearchSelect>
          </Field>
          <Field label="Room" optional>
            <input name="location" maxLength={60} defaultValue={initial?.location ?? ""} placeholder="e.g. Studio 1" className={inputClass} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="How members join">
        <ChoiceChips
          name="join_mode"
          label="How members join"
          size="lg"
          columns={2}
          value={course ? "course" : "session"}
          onChange={(v) => setCourse(v === "course")}
          options={[
            { value: "session", label: "Book each session", hint: "Free with their membership" },
            { value: "course", label: "Monthly course", hint: "They subscribe and pay per month" },
          ]}
        />
        {course && (
          <Field label="Price per month (USD)">
            <AffixInput prefix="$" name="monthly_price_usd" required inputMode="decimal" defaultValue={initial?.monthly_price_usd ?? ""} placeholder="50" />
          </Field>
        )}
      </FormSection>

      <Field label="Description" optional>
        <input name="description" maxLength={500} defaultValue={initial?.description ?? ""} placeholder="e.g. Bring a towel" className={inputClass} />
      </Field>

      <Button type="submit" disabled={pending} className="h-11 w-full">
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
  today,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  coaches: Coach[];
  defaultDate: string;
  today: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const weekdayName = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const shortcuts = [
    ...(defaultDate <= today ? [{ label: "Today", value: today }] : []),
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: weekdayName(addDays(today, 2)), value: addDays(today, 2) },
    { label: weekdayName(addDays(today, 3)), value: addDays(today, 3) },
  ];

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Trainer">
        <SearchSelect name="trainer_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose a trainer…
          </option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || "Trainer"}
            </option>
          ))}
        </SearchSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" group>
          <DateField name="date" label="Date" min={defaultDate} defaultValue={defaultDate} shortcuts={shortcuts} />
        </Field>
        <Field label="Time">
          <input name="time" type="time" required defaultValue="18:00" className={inputClass} />
        </Field>
      </div>
      <Field label="Length" group>
        <ChoiceChips
          name="duration_min"
          label="Length"
          defaultValue="60"
          options={[30, 45, 60, 90].map((m) => ({ value: String(m), label: lengthLabel(m) }))}
        />
      </Field>
      <Field label="Note" optional>
        <input name="note" maxLength={500} placeholder="e.g. Want to work on squat technique" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
