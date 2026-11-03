"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { addDays, formatDate, formatUSD, planLength, type PlanPeriod } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";
import { PaymentFields } from "./payment-fields";

export type SellablePlan = {
  id: string;
  name: string;
  price_usd: number;
  period: PlanPeriod;
  period_count: number;
  visit_limit: number | null;
};

function endDate(start: string, plan: SellablePlan) {
  const d = new Date(`${start}T00:00:00Z`);
  if (plan.period === "day") d.setUTCDate(d.getUTCDate() + plan.period_count);
  if (plan.period === "week") d.setUTCDate(d.getUTCDate() + 7 * plan.period_count);
  if (plan.period === "month") d.setUTCMonth(d.getUTCMonth() + plan.period_count);
  if (plan.period === "year") d.setUTCFullYear(d.getUTCFullYear() + plan.period_count);
  return addDays(d.toISOString().slice(0, 10), -1);
}

export function SellForm({
  action,
  plans,
  defaultStart,
  rate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  plans: SellablePlan[];
  defaultStart: string;
  rate: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [start, setStart] = useState(defaultStart);
  const [discount, setDiscount] = useState("0");
  const [paidTyped, setPaidTyped] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);
  const total = Math.max((plan?.price_usd ?? 0) - (Number(discount) || 0), 0);
  const paid = paidTyped ?? total.toFixed(2);

  if (!plans.length) {
    return <p className="text-sm text-muted">Create a membership plan first (Plans in the menu).</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Plan">
          <select
            name="plan_id"
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setPaidTyped(null);
            }}
            className={inputClass}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatUSD(p.price_usd)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts on">
          <input name="starts_on" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Discount (USD)">
          <input
            name="discount_usd"
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              setPaidTyped(null);
            }}
            className={inputClass}
          />
        </Field>
      </div>

      {plan && start && (
        <p className="rounded-lg bg-canvas px-3 py-2 text-sm">
          <strong>{plan.name}</strong> · {planLength(plan.period, plan.period_count)}
          {plan.visit_limit ? ` · ${plan.visit_limit} visits` : ""} · {formatDate(start)} → {formatDate(endDate(start, plan))} ·
          Total <strong>{formatUSD(total)}</strong>
        </p>
      )}

      <PaymentFields amountUsd={paid} onAmountChange={setPaidTyped} rate={rate} amountLabel="Paid now (USD)" optional />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Sell membership"}
      </Button>
    </form>
  );
}
