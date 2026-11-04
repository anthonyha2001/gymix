"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { AffixInput, ChoiceChips, DateField, FormSection, Summary } from "@/components/form-controls";
import { Alert, Button, Field } from "@/components/ui";
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
  today = defaultStart,
  rate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  plans: SellablePlan[];
  // Today, or the day after the member's current membership ends.
  defaultStart: string;
  today?: string;
  rate: number;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [start, setStart] = useState(defaultStart);
  const [discount, setDiscount] = useState("");
  const [paidTyped, setPaidTyped] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);
  const discountUsd = Math.max(Number(discount) || 0, 0);
  const total = Math.max((plan?.price_usd ?? 0) - discountUsd, 0);
  const paid = paidTyped ?? total.toFixed(2);
  const owed = Math.max(total - (Number(paid) || 0), 0);

  if (!plans.length) {
    return <p className="text-sm text-muted">Create a membership plan first (Plans in the menu).</p>;
  }

  const shortcuts = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    ...(defaultStart > today ? [{ label: "After the current one ends", value: defaultStart }] : []),
  ];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <FormSection title="Membership">
        <Field label="Plan" group>
          <ChoiceChips
            name="plan_id"
            label="Plan"
            size="lg"
            columns={plans.length > 1 ? 2 : 1}
            value={planId}
            onChange={(v) => {
              setPlanId(v);
              setPaidTyped(null);
            }}
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.name} · ${formatUSD(p.price_usd)}`,
              hint: `${planLength(p.period, p.period_count)}${p.visit_limit ? ` · ${p.visit_limit} visits` : " · unlimited visits"}`,
            }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts on" group>
            <DateField name="starts_on" label="Starts on" value={start} onChange={setStart} shortcuts={shortcuts} />
          </Field>
          <Field label="Discount (USD)" optional>
            <AffixInput
              prefix="$"
              name="discount_usd"
              inputMode="decimal"
              placeholder="0"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                setPaidTyped(null);
              }}
            />
          </Field>
        </div>
      </FormSection>

      {plan && start && (
        <Summary
          rows={[
            { label: plan.name, value: formatUSD(plan.price_usd) },
            ...(discountUsd ? [{ label: "Discount", value: `−${formatUSD(discountUsd)}` }] : []),
            { label: "Valid", value: `${formatDate(start)} → ${formatDate(endDate(start, plan))}`, muted: true },
          ]}
          total={{ label: "Total", value: formatUSD(total) }}
        />
      )}

      <FormSection title="Payment">
        <PaymentFields amountUsd={paid} onAmountChange={setPaidTyped} rate={rate} amountLabel="Paid now (USD)" optional />
        {owed > 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{formatUSD(owed)}</strong> will stay on their account to pay later.
          </p>
        )}
      </FormSection>

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : `Sell membership · ${formatUSD(total)}`}
      </Button>
    </form>
  );
}
