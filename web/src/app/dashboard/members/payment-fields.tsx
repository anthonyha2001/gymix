"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { PAYMENT_METHODS, formatLBP, usdToLbp, type PaymentMethod } from "@/lib/format";
import { SearchSelect } from "@/components/search-select";

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
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={amountLabel} hint={optional ? "Enter 0 if they'll pay later." : undefined}>
        <input
          name="amount_usd"
          inputMode="decimal"
          value={amountUsd}
          onChange={(e) => onAmountChange(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Paid by">
        <SearchSelect
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className={inputClass}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SearchSelect>
      </Field>
      {method === "cash_lbp" && (
        <Field label="Received in LBP" hint={`At your rate of ${formatLBP(rate)} per $1.`}>
          <input
            name="amount_lbp"
            inputMode="numeric"
            value={lbpTyped ?? String(suggestedLbp)}
            onChange={(e) => setLbpTyped(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}
    </div>
  );
}
