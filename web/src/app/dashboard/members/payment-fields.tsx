"use client";

import { useState } from "react";
import { AffixInput, ChoiceChips } from "@/components/form-controls";
import { Field } from "@/components/ui";
import { PAYMENT_METHODS, formatLBP, usdToLbp, type PaymentMethod } from "@/lib/format";

// Amount + method, plus the lira amount when paid in LBP cash (pre-filled from
// the gym's rate, editable for what was actually handed over).
export function PaymentFields({
  amountUsd,
  onAmountChange,
  rate,
  amountLabel = "Amount paid (USD)",
  optional = false,
}: {
  amountUsd: string;
  onAmountChange: (value: string) => void;
  rate: number;
  amountLabel?: string;
  optional?: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash_usd");
  const [lbpTyped, setLbpTyped] = useState<string | null>(null);
  const suggestedLbp = usdToLbp(Number(amountUsd) || 0, rate);

  return (
    <div className="space-y-4">
      <Field label={amountLabel} hint={optional ? "Enter 0 if they'll pay later." : undefined}>
        <AffixInput prefix="$" name="amount_usd" inputMode="decimal" value={amountUsd} onChange={(e) => onAmountChange(e.target.value)} />
      </Field>
      <Field label="Paid by" group>
        <ChoiceChips
          name="method"
          label="Paid by"
          value={method}
          onChange={(v) => setMethod(v as PaymentMethod)}
          options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        />
      </Field>
      {method === "cash_lbp" && (
        <Field label="Received in LBP" hint={`At your rate of ${formatLBP(rate)} per $1.`}>
          <AffixInput
            suffix="LBP"
            name="amount_lbp"
            inputMode="numeric"
            value={lbpTyped ?? String(suggestedLbp)}
            onChange={(e) => setLbpTyped(e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
