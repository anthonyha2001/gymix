"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { PLAN_PERIODS, type PlanPeriod } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";

export type PlanValues = {
  name: string;
  price_usd: number;
  period: PlanPeriod;
  period_count: number;
  visit_limit: number | null;
  description: string | null;
};

export function PlanForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: PlanValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name">
          <input name="name" required maxLength={80} defaultValue={initial?.name} placeholder="e.g. Monthly" className={inputClass} />
        </Field>
        <Field label="Price (USD)">
          <input
            name="price_usd"
            required
            inputMode="decimal"
            defaultValue={initial?.price_usd}
            placeholder="40"
            className={inputClass}
          />
        </Field>
        <Field label="Length">
          <div className="flex gap-2">
            <input
              name="period_count"
              type="number"
              min={1}
              max={36}
              required
              defaultValue={initial?.period_count ?? 1}
              className={`${inputClass} w-20`}
            />
            <select name="period" defaultValue={initial?.period ?? "month"} className={inputClass}>
              {PLAN_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.plural}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Visit limit" hint="Leave empty for unlimited visits. Set it for punch cards (e.g. 10 visits).">
          <input
            name="visit_limit"
            type="number"
            min={1}
            max={1000}
            defaultValue={initial?.visit_limit ?? ""}
            placeholder="Unlimited"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Description (optional)">
        <input
          name="description"
          maxLength={500}
          defaultValue={initial?.description ?? ""}
          placeholder="e.g. Gym floor access, classes not included"
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
