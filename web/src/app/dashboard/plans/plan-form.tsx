"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { AffixInput, ChoiceChips, Stepper } from "@/components/form-controls";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { PLAN_PERIODS, formatUSD, planLength, type PlanPeriod } from "@/lib/format";
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
  const [state, formAction, pending] = useDialogAction(action, {});
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price_usd) : "");
  const [count, setCount] = useState(initial?.period_count ?? 1);
  const [period, setPeriod] = useState<PlanPeriod>(initial?.period ?? "month");
  const [limited, setLimited] = useState(Boolean(initial?.visit_limit));
  const [visits, setVisits] = useState(initial?.visit_limit ?? 10);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name">
          <input name="name" required maxLength={80} autoFocus={!initial} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly" className={inputClass} />
        </Field>
        <Field label="Price (USD)">
          <AffixInput prefix="$" name="price_usd" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="40" />
        </Field>
      </div>

      <Field label="Length" group>
        <div className="flex flex-wrap items-center gap-3">
          <Stepper name="period_count" label="Length" value={count} onChange={setCount} min={1} max={36} />
          <ChoiceChips
            name="period"
            label="Length unit"
            value={period}
            onChange={(v) => setPeriod(v as PlanPeriod)}
            options={PLAN_PERIODS.map((p) => ({ value: p.value, label: count === 1 ? p.label : p.plural }))}
          />
        </div>
      </Field>

      <Field label="Visits" group hint="Limited plans work like punch cards: each check-in uses one visit.">
        <div className="flex flex-wrap items-center gap-3">
          <ChoiceChips
            name="visit_mode"
            label="Visits"
            value={limited ? "limited" : "unlimited"}
            onChange={(v) => setLimited(v === "limited")}
            options={[
              { value: "unlimited", label: "Unlimited" },
              { value: "limited", label: "Limited" },
            ]}
          />
          {limited && <Stepper name="visit_limit" label="Visit limit" value={visits} onChange={setVisits} min={1} max={1000} suffix="visits" />}
        </div>
      </Field>

      <Field label="Description" optional>
        <input
          name="description"
          maxLength={500}
          defaultValue={initial?.description ?? ""}
          placeholder="e.g. Gym floor access, classes not included"
          className={inputClass}
        />
      </Field>

      <p className="rounded-xl bg-canvas px-4 py-3 text-sm">
        <strong>{name || "This plan"}</strong>: {Number(price) ? formatUSD(Number(price)) : "$—"} for {planLength(period, count)},{" "}
        {limited ? `${visits} visits` : "unlimited visits"}.
      </p>

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
