"use client";

import { useState } from "react";
import { useDialogAction } from "@/components/dialog";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { formatUSD } from "@/lib/format";
import type { ActionState } from "@/lib/action-result";
import { PaymentFields } from "./payment-fields";

export function PaymentForm({
  action,
  balance,
  rate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  balance: number;
  rate: number;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  const [amount, setAmount] = useState(balance.toFixed(2));
  const left = Math.max(balance - (Number(amount) || 0), 0);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex items-baseline justify-between rounded-xl bg-canvas px-4 py-3">
        <span className="text-sm text-muted">They owe on this invoice</span>
        <span className="text-xl font-semibold tabular-nums">{formatUSD(balance)}</span>
      </div>
      <PaymentFields amountUsd={amount} onAmountChange={setAmount} rate={rate} />
      {left > 0 && (
        <p className="text-sm text-muted">
          <strong className="text-ink">{formatUSD(left)}</strong> stays on the invoice after this payment.
        </p>
      )}
      <Field label="Note" optional>
        <input name="note" maxLength={200} placeholder="e.g. Paid by their brother" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Saving…" : `Record payment · ${formatUSD(Number(amount) || 0)}`}
      </Button>
    </form>
  );
}
